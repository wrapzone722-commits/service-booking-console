import { useEffect, useState, useRef } from "react";
import { CarFolder, CarImage } from "@shared/api";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const THUMB_SIZE = 200;
const PREVIEW_SIZE = 800;

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

export default function Cars() {
  const [folders, setFolders] = useState<CarFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<CarFolder | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<CarImage | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchFolders();
  }, []);

  const fetchFolders = async () => {
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
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList?.length) return;
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (!files.length) {
      setError("В папке нет изображений");
      e.target.value = "";
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const token = localStorage.getItem("session_token");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const grouped = new Map<string, File[]>();
      for (const file of files) {
        const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        const parts = path.split("/");
        const folderKey =
          parts.length > 1 ? parts[0] : `Новая папка ${Date.now().toString().slice(-6)}`;
        if (!grouped.has(folderKey)) grouped.set(folderKey, []);
        grouped.get(folderKey)!.push(file);
      }
      for (const [folderName, folderFiles] of grouped) {
        const images: CarImage[] = [];
        for (const file of folderFiles) {
          const filename = file.name;
          const [url, thumbnail_url] = await Promise.all([
            resizeImage(file, PREVIEW_SIZE, 0.88),
            resizeImage(file, THUMB_SIZE, 0.82),
          ]);
          images.push({ name: filename, url, thumbnail_url });
        }
        const res = await fetch("/api/v1/cars/folders", {
          method: "POST",
          headers,
          body: JSON.stringify({ name: folderName, images }),
        });
        if (!res.ok) throw new Error("Ошибка загрузки");
      }
      await fetchFolders();
    } catch (err) {
      setError("Ошибка загрузки папки");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

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

        <div className="mb-4 flex flex-wrap gap-3">
          <input
            ref={folderInputRef}
            type="file"
            {...({ webkitdirectory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
            multiple
            accept="image/*"
            onChange={handleFolderSelect}
            className="hidden"
            aria-label="Загрузить папку"
          />
          <button
            onClick={() => folderInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? "Загрузка..." : "📁 Загрузить папку / папки"}
          </button>
          <span className="text-xs text-muted-foreground self-center">
            Выберите папку или папку с подпапками — загрузятся все подпапки
          </span>
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
              const defaultImg = getDefaultImage(folder);
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
                    {defaultImg ? (
                      <img
                        src={defaultImg.thumbnail_url}
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
