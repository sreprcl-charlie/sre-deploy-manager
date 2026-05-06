import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, X, ImageIcon, Loader2, Trash2 } from "lucide-react";
import api from "../api/client";
import toast from "react-hot-toast";

// Compress image to max 1200px wide, 85% quality → keeps screenshots readable
async function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX_W = 1200;
      const scale = img.width > MAX_W ? MAX_W / img.width : 1;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const sizeKb = Math.round((dataUrl.length * 3) / 4 / 1024);
      resolve({ dataUrl, sizeKb });
    };
    img.src = url;
  });
}

export default function EvidenceUpload({ crId, readOnly = false }) {
  const [evidence, setEvidence] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { src, name }
  const inputRef = useRef(null);

  // Load existing evidence on first render
  const loadEvidence = useCallback(async () => {
    if (loaded) return;
    try {
      const res = await api.get(`/evidence?cr_id=${crId}`);
      setEvidence(res.data.evidence);
      setLoaded(true);
    } catch {
      toast.error("Gagal memuat evidence");
    }
  }, [crId, loaded]);

  // Load existing evidence on mount
  useEffect(() => { loadEvidence(); }, [loadEvidence]);

  const processFiles = async (files) => {
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!images.length) {
      toast.error("Hanya file gambar yang bisa diupload");
      return;
    }
    setUploading(true);
    let uploaded = 0;
    for (const file of images) {
      try {
        const { dataUrl, sizeKb } = await compressImage(file);
        const res = await api.post("/evidence", {
          cr_id: crId,
          filename: file.name,
          file_type: "image/jpeg",
          file_size_kb: sizeKb,
          data: dataUrl,
        });
        setEvidence((prev) => [...prev, { ...res.data.evidence, uploaded_by_name: "Anda" }]);
        uploaded++;
      } catch (err) {
        toast.error(`Gagal upload ${file.name}: ${err.response?.data?.error || "error"}`);
      }
    }
    if (uploaded > 0) toast.success(`${uploaded} evidence berhasil diupload`);
    setUploading(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const handleDelete = async (ev) => {
    try {
      await api.delete(`/evidence/${ev.id}`);
      setEvidence((prev) => prev.filter((e) => e.id !== ev.id));
      toast.success("Evidence dihapus");
    } catch (err) {
      toast.error(err.response?.data?.error || "Gagal menghapus");
    }
  };

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-300 text-sm">
          Evidence Deployment
          <span className="ml-2 text-xs font-normal text-slate-500">
            ({evidence.length} file)
          </span>
        </h2>
        {!readOnly && (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            Upload
          </button>
        )}
      </div>

      {/* Drag & Drop zone — hidden when read-only */}
      {!readOnly && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            dragging
              ? "border-sky-500 bg-sky-950/30"
              : "border-slate-600 hover:border-slate-500 bg-slate-900/40"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => processFiles(e.target.files)}
          />
          <Upload size={24} className="mx-auto text-slate-500 mb-2" />
          <p className="text-sm text-slate-400">
            Drag & drop screenshot ke sini, atau <span className="text-sky-400">klik untuk pilih</span>
          </p>
          <p className="text-xs text-slate-600 mt-1">
            PNG, JPG, WEBP — multiple files — otomatis dikompres
          </p>
          {uploading && (
            <div className="absolute inset-0 bg-slate-900/60 rounded-xl flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-sky-400" />
            </div>
          )}
        </div>
      )}

      {/* Gallery */}
      {evidence.length === 0 ? (
        <p className="text-slate-600 text-sm text-center py-2">Belum ada evidence diupload</p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {evidence.map((ev) => (
            <div key={ev.id} className="relative group rounded-lg overflow-hidden border border-slate-700/50 bg-slate-900">
              <img
                src={ev.data}
                alt={ev.filename}
                className="w-full h-28 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setLightbox({ src: ev.data, name: ev.filename })}
              />
              <div className="px-2 py-1.5">
                <p className="text-xs text-slate-400 truncate">{ev.filename}</p>
                <p className="text-xs text-slate-600">{ev.file_size_kb} KB · {ev.uploaded_by_name}</p>
              </div>
              {!readOnly && (
                <button
                  onClick={() => handleDelete(ev)}
                  className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-red-900/80 hover:bg-red-700 text-red-300 rounded p-0.5"
                  title="Hapus evidence"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white"
            onClick={() => setLightbox(null)}
          >
            <X size={28} />
          </button>
          <div className="max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.src} alt={lightbox.name} className="w-full rounded-lg shadow-2xl" />
            <p className="text-center text-slate-400 text-sm mt-3">{lightbox.name}</p>
          </div>
        </div>
      )}
    </div>
  );
}
