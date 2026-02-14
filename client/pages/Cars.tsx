import { useEffect, useState, useRef, useCallback } from "react";
import { CarFolder, CarImage } from "@shared/api";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const THUMB_SIZE = 200;
const PREVIEW_SIZE = 800;

const IMAGE_EXTS = /\.(jpe?g|png|gif|webp|bmp)$/i;

function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return IMAGE_EXTS.test(file.name);
}

function resizeImage(file: File, maxSize: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = (height / width) * maxSize;
          width = maxSize;
        } else {
          width = (width / height) * maxSize;
          height = maxSize;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("No canvas"));
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

function getBaseName(filename: string): string {
  return filename.replace(/\.[^/.]+$/, "");
}

interface FileWithPath {
  file: File;
  relativePath: string;
}

async function readDirectoryRecursive(
  entry: FileSystemDirectoryEntry,
  basePath = ""
): Promise<FileWithPath[]> {
  const results: FileWithPath[] = [];
  const reader = entry.createReader();
  const readBatch = (): Promise<FileSystemEntry[]> =>
    new Promise((resolve, reject) => reader.readEntries(resolve, reject));

  let entries: FileSystemEntry[];
  do {
    entries = await readBatch();
    for (const e of entries) {
      const path = basePath ? `${basePath}/${e.name}` : e.name;
      if (e.isFile) {
        const file = await new Promise<File>((resolve, reject) =>
          (e as FileSystemFileEntry).file(resolve, reject)
        );
        results.push({ file, relativePath: path });
      } else {
        const sub = await readDirectoryRecursive(e as FileSystemDirectoryEntry, path);
        results.push(...sub);
      }
    }
  } while (entries.length > 0);
  return results;
}

async function getFilesFromDataTransfer(items: DataTransferItemList): Promise<FileWithPath[]> {
  const out: FileWithPath[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind !== "file") continue;
    const entry = item.webkitGetAsEntry?.();
    if (!entry) {
      const file = item.getAsFile();
      if (file) out.push({ file, relativePath: file.name });
      continue;
    }
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) =>
        (entry as FileSystemFileEntry).file(resolve, reject)
      );
      out.push({ file, relativePath: file.name });
    } else {
      const files = await readDirectoryRecursive(entry as FileSystemDirectoryEntry, entry.name);
      out.push(...files);
    }
  }
  return out;
}

export default function Cars() {
  const [folders, setFolders] = useState<CarFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<CarFolder | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<CarImage | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const fetchFolders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/cars/folders");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setFolders(data);
      setError(null);
    } catch (err) {
      setError("Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const processAndUpload = useCallback(
    async (filesWithPath: FileWithPath[]) => {
      const imageFiles = filesWithPath.filter((f) => isImageFile(f.file));
      if (!imageFiles.length) {
        setError("Нет изображений (jpeg, png, gif, webp)");
        return;
      }
      setUploading(true);
      setError(null);
      try {
        const token = localStorage.getItem("session_token");
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
        const grouped = new Map<string, FileWithPath[]>();
        const fallbackName = `Новая папка ${Date.now().toString().slice(-6)}`;
        for (const item of imageFiles) {
          const parts = item.relativePath.split("/");
          const folderKey = parts.length > 1 ? parts[0] : fallbackName;
          if (!grouped.has(folderKey)) grouped.set(folderKey, []);
          grouped.get(folderKey)!.push(item);
        }
        for (const [folderName, folderItems] of grouped) {
          const images: CarImage[] = [];
          for (const { file } of folderItems) {
            const [url, thumbnail_url] = await Promise.all([
              resizeImage(file, PREVIEW_SIZE, 0.88),
              resizeImage(file, THUMB_SIZE, 0.82),
            ]);
            images.push({ name: file.name, url, thumbnail_url });
          }
          const res = await fetch("/api/v1/cars/folders", {
            method: "POST",
            headers,
            body: JSON.stringify({ name: folderName, images }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message || data.error || `Ошибка ${res.status}`);
          }
        }
        await fetchFolders();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Ошибка загрузки";
        setError(msg);
        console.error("Cars upload error:", err);
      } finally {
        setUploading(false);
      }
    },
    [fetchFolders]
  );

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList?.length) return;
    const filesWithPath: FileWithPath[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const path =
        (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      filesWithPath.push({ file, relativePath: path });
    }
    await processAndUpload(filesWithPath);
    e.target.value = "";
  };

  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (uploading) return;
      const items = e.dataTransfer?.items;
      if (!items?.length) return;
      try {
        const filesWithPath = await getFilesFromDataTransfer(items);
        await processAndUpload(filesWithPath);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка при перетаскивании");
        console.error("Drop error:", err);
      }
    },
    [processAndUpload, uploading]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
  }, []);

  const handleDeleteFolder = async (id: string) => {
    if (!confirm("Удалить папку и все фото?")) return;
    try {
      const token = localStorage.getItem("session_token");
      const res = await fetch(`/api/v1/cars/folders/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      await fetchFolders();
      if (selectedFolder?._id === id) setSelectedFolder(null);
    } catch {
      setError("Ошибка удаления");
    }
  };

  const getDefaultImage = (folder: CarFolder): CarImage | null => {
    const def = folder.images.find((img) => getBaseName(img.name) === "01");
    return def || folder.images[0] || null;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-white dark:bg-card border-b border-border shadow-sm sticky top-0 z-10">
        <div className="px-4 md:px-6 py-3">
          <h1 className="text-2xl font-bold text-foreground">Автомобили</h1>
          <p className="text-xs text-muted-foreground">
            Папки с аватарками для профиля. По умолчанию фото «01» — фото профиля. iOS отображает миниатюры.
          </p>
        </div>
      </div>

      <div className="p-4 md:p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`mb-4 rounded-xl border-2 border-dashed p-6 transition-colors ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/30 hover:border-primary/50"
          } ${uploading ? "pointer-events-none opacity-70" : ""}`}
        >
          <input
            ref={folderInputRef}
            type="file"
            {...({ webkitdirectory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
            multiple
            onChange={handleFolderSelect}
            className="hidden"
            aria-label="Загрузить папку"
          />
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              onClick={() => folderInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 w-fit"
            >
              {uploading ? "Загрузка..." : "📁 Выбрать папку"}
            </button>
            <span className="text-sm text-muted-foreground">
              или перетащите сюда папки (можно несколько)
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Выберите папку или перетащите несколько папок. Будут загружены все изображения (jpg, png, gif, webp).
          </p>
        </div>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Загрузка...</div>
        ) : folders.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground rounded-lg border border-dashed border-border">
            <p className="mb-2">Нет папок. Нажмите «Загрузить папку» и выберите папку с фото.</p>
            <p className="text-xs">Рекомендуется: файл 01.jpg (или 01.png) — фото профиля по умолчанию.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {folders.map((folder) => {
              const previewThumb = folder.profile_preview_thumbnail_url ?? getDefaultImage(folder)?.thumbnail_url;
              return (
                <div
                  key={folder._id}
                  onClick={() => setSelectedFolder(selectedFolder?._id === folder._id ? null : folder)}
                  className={`rounded-lg border-2 overflow-hidden cursor-pointer transition-all ${
                    selectedFolder?._id === folder._id
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="aspect-square bg-muted flex items-center justify-center">
                    {previewThumb ? (
                      <img
                        src={previewThumb}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-4xl text-muted-foreground">🚗</span>
                    )}
                  </div>
                  <div className="p-2 bg-card">
                    <p className="font-semibold text-sm truncate">{folder.name}</p>
                    <p className="text-xs text-muted-foreground">{folder.images.length} фото</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedFolder && (
          <div className="mt-6 bg-white dark:bg-card rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{selectedFolder.name}</h2>
              <button
                onClick={() => handleDeleteFolder(selectedFolder._id)}
                className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 rounded-lg hover:bg-red-200"
              >
                Удалить папку
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Фото «01» — по умолчанию для профиля. iOS отображает миниатюры.
            </p>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {selectedFolder.images.map((img) => (
                <button
                  key={img.name}
                  type="button"
                  onClick={() => setPreviewImage(img)}
                  className={`aspect-square rounded-lg overflow-hidden border-2 text-left ${
                    getBaseName(img.name) === "01" ? "border-primary ring-2 ring-primary/30" : "border-border"
                  } hover:ring-2 hover:ring-primary/50 transition-all`}
                >
                  <img
                    src={img.thumbnail_url}
                    alt={img.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <p className="text-[10px] text-center truncate px-0.5">{img.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-2 overflow-auto">
            {previewImage && (
              <div className="space-y-2">
                <img
                  src={previewImage.url}
                  alt={previewImage.name}
                  className="max-w-full max-h-[85vh] w-auto h-auto object-contain mx-auto rounded"
                />
                <p className="text-center text-sm text-muted-foreground">{previewImage.name}</p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
