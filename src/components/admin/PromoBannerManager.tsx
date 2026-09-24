import React, { useState, useRef, useEffect } from 'react';
import { useContent } from '../../context/ContentContext';
import { PromoBanner } from '../../types';
import { resolveMediaUrl } from '../../utils/api';
import { PromoBannerCarousel } from '../public/PromoBannerCarousel';
import {
  Images,
  Upload,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Plus,
  Loader2,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  RotateCcw,
  Edit2,
  X,
  Layers,
  AlertCircle,
} from 'lucide-react';

export const PromoBannerManager: React.FC = () => {
  const { data, updateData, saveData, uploadImage, showToast } = useContent();

  const [banners, setBanners] = useState<PromoBanner[]>(() => {
    return Array.isArray(data.promoBanners) ? data.promoBanners : [];
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Modal / Form state for Add / Edit
  const [editingBanner, setEditingBanner] = useState<PromoBanner | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formSubtitle, setFormSubtitle] = useState<string>('');
  const [formImageUrl, setFormImageUrl] = useState<string>('');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formSortOrder, setFormSortOrder] = useState<number>(1);
  const [showLivePreview, setShowLivePreview] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep local state in sync when context data updates
  useEffect(() => {
    if (Array.isArray(data.promoBanners)) {
      setBanners(data.promoBanners);
    }
  }, [data.promoBanners]);

  const handleOpenAddModal = () => {
    const nextOrder = banners.length > 0 ? Math.max(...banners.map((b) => b.sortOrder || 0)) + 1 : 1;
    setEditingBanner(null);
    setFormTitle('');
    setFormSubtitle('');
    setFormImageUrl('');
    setFormIsActive(true);
    setFormSortOrder(nextOrder);
    setUploadError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (banner: PromoBanner) => {
    setEditingBanner(banner);
    setFormTitle(banner.title || '');
    setFormSubtitle(banner.subtitle || '');
    setFormImageUrl(banner.imageUrl || '');
    setFormIsActive(banner.isActive !== false);
    setFormSortOrder(banner.sortOrder || 1);
    setUploadError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingBanner(null);
    setUploadError(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Format file tidak didukung. Harap upload gambar (JPG/PNG/WEBP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Ukuran file terlalu besar. Maksimal 10MB.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const uploadedUrl = await uploadImage(file, 'promo_banner');
      if (uploadedUrl) {
        setFormImageUrl(uploadedUrl);
        showToast('Gambar promo berhasil diupload!', 'success');
      } else {
        setUploadError('Gagal mengupload gambar. Silakan coba lagi.');
      }
    } catch (err: any) {
      setUploadError('Terjadi kesalahan saat upload gambar: ' + (err?.message || 'Error'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveModalForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formImageUrl.trim()) {
      setUploadError('Gambar banner wajib diupload.');
      return;
    }

    let updatedList: PromoBanner[];

    if (editingBanner) {
      // Edit existing
      updatedList = banners.map((b) => {
        if (b.id === editingBanner.id) {
          return {
            ...b,
            title: formTitle.trim(),
            subtitle: formSubtitle.trim(),
            imageUrl: formImageUrl.trim(),
            isActive: formIsActive,
            sortOrder: formSortOrder,
            updatedAt: new Date().toISOString(),
          };
        }
        return b;
      });
    } else {
      // Create new banner
      const newBanner: PromoBanner = {
        id: `banner-${Date.now()}`,
        title: formTitle.trim(),
        subtitle: formSubtitle.trim(),
        imageUrl: formImageUrl.trim(),
        isActive: formIsActive,
        sortOrder: formSortOrder,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updatedList = [...banners, newBanner];
    }

    // Sort by sortOrder
    updatedList.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    setBanners(updatedList);
    persistBanners(updatedList, true);
    handleCloseModal();
  };

  const handleToggleActive = (id: string) => {
    const updated = banners.map((b) => {
      if (b.id === id) {
        return { ...b, isActive: !b.isActive };
      }
      return b;
    });
    setBanners(updated);
    persistBanners(updated, false);
  };

  const handleDeleteBanner = (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus banner promo ini?')) {
      const updated = banners.filter((b) => b.id !== id);
      setBanners(updated);
      persistBanners(updated, true);
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const list = [...banners];
    const temp = list[index];
    list[index] = list[index - 1];
    list[index - 1] = temp;

    // re-assign sortOrder
    const reordered = list.map((item, idx) => ({
      ...item,
      sortOrder: idx + 1,
    }));

    setBanners(reordered);
    persistBanners(reordered, false);
  };

  const handleMoveDown = (index: number) => {
    if (index >= banners.length - 1) return;
    const list = [...banners];
    const temp = list[index];
    list[index] = list[index + 1];
    list[index + 1] = temp;

    // re-assign sortOrder
    const reordered = list.map((item, idx) => ({
      ...item,
      sortOrder: idx + 1,
    }));

    setBanners(reordered);
    persistBanners(reordered, false);
  };

  const persistBanners = async (newList: PromoBanner[], notify = false): Promise<boolean> => {
    setIsSaving(true);
    try {
      let success = false;
      if (typeof updateData === 'function') {
        success = await updateData({
          promoBanners: newList,
        });
      } else if (typeof saveData === 'function') {
        success = await saveData({
          ...data,
          promoBanners: newList,
        });
      }

      if (notify) {
        if (success) {
          showToast('Daftar Promo Banner berhasil disimpan ke database!', 'success');
        } else {
          showToast('Tersimpan di cache browser.', 'info');
        }
      }
      return success;
    } catch (err: any) {
      console.error('[CMS Promo Banner Error]:', err);
      showToast('Gagal menyimpan perubahan ke database.', 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const activeBannersPreview = banners
    .filter((b) => b.isActive !== false && b.imageUrl)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#00E5FF]/10 text-[#00E5FF] flex items-center justify-center border border-[#00E5FF]/20">
              <Images className="w-5 h-5" />
            </div>
            <h2 className="font-display font-black text-2xl text-white uppercase tracking-tight">
              PROMO BANNER CAROUSEL
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Kelola multi-foto banner promo berformat landscape yang tampil sebagai carousel otomatis di area Hero Homepage.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => persistBanners(banners, true)}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-[#00E5FF] hover:bg-[#3cf0ff] text-slate-950 font-display font-bold text-xs tracking-wider uppercase flex items-center gap-2 shadow-lg shadow-[#00E5FF]/20 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isSaving ? 'Menyimpan...' : 'SIMPAN KE DATABASE'}</span>
          </button>
        </div>
      </div>

      {/* Live Preview Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#00E5FF]" />
            <h3 className="font-display font-bold text-sm text-white uppercase tracking-wider">
              Live Preview Carousel ({activeBannersPreview.length} Banner Aktif)
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowLivePreview(!showLivePreview)}
            className="text-xs font-mono text-slate-400 hover:text-[#00E5FF] flex items-center gap-1.5 cursor-pointer"
          >
            {showLivePreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-[#00E5FF]" />}
            <span>{showLivePreview ? 'Sembunyikan' : 'Tampilkan'}</span>
          </button>
        </div>

        {showLivePreview && (
          <div className="w-full max-w-3xl mx-auto pt-2">
            {activeBannersPreview.length > 0 ? (
              <PromoBannerCarousel
                banners={activeBannersPreview}
                autoSlideInterval={4500}
                aspectRatioClass="aspect-[16/7] md:aspect-[21/9]"
                className="border border-slate-700 shadow-2xl"
              />
            ) : (
              <div className="p-8 rounded-2xl bg-slate-950/80 border border-dashed border-slate-800 text-center text-slate-500 text-xs">
                Belum ada banner aktif. Klik <strong>"+ Tambah Banner"</strong> di bawah untuk menambahkan banner promo.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Banners List Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-base text-white uppercase tracking-wide">
              Daftar Banner Promo ({banners.length})
            </h3>
            <p className="text-xs text-slate-400">
              Atur urutan, aktifkan/nonaktifkan, atau hapus banner promo.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[#00E5FF] text-xs font-bold font-mono uppercase flex items-center gap-2 transition-all cursor-pointer active:scale-95 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>+ Tambah Banner</span>
          </button>
        </div>

        {banners.length === 0 ? (
          <div className="p-10 rounded-2xl bg-slate-900/50 border-2 border-dashed border-slate-800 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-[#00E5FF] flex items-center justify-center mx-auto">
              <Images className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-white text-sm">Belum Ada Banner Promo</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Tambahkan foto promo untuk ditampilkan pada carousel homepage customer.
            </p>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-5 py-2.5 rounded-xl bg-[#00E5FF] text-slate-950 font-bold text-xs uppercase cursor-pointer transition-all hover:bg-[#3cf0ff]"
            >
              + Tambah Banner Pertama
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {banners.map((banner, index) => {
              const isFirst = index === 0;
              const isLast = index === banners.length - 1;

              return (
                <div
                  key={banner.id || `banner-row-${index}`}
                  className={`p-3.5 sm:p-4 rounded-2xl bg-slate-900/90 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    banner.isActive !== false ? 'border-slate-800' : 'border-slate-800/40 opacity-60'
                  }`}
                >
                  {/* Left: Thumbnail & Info */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-24 sm:w-32 aspect-[16/9] rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center relative">
                      {banner.imageUrl ? (
                        <img
                          src={resolveMediaUrl(banner.imageUrl)}
                          alt={banner.title || 'Promo Banner'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Images className="w-5 h-5 text-slate-600" />
                      )}

                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-slate-950/80 text-[9px] font-mono font-bold text-white border border-slate-700">
                        #{index + 1}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-white truncate">
                          {banner.title || `Banner Promo #${index + 1}`}
                        </h4>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                            banner.isActive !== false
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {banner.isActive !== false ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </div>
                      {banner.subtitle && (
                        <p className="text-xs text-slate-400 truncate mt-0.5">{banner.subtitle}</p>
                      )}
                      <p className="text-[10px] font-mono text-slate-500 mt-1">
                        Urutan: {banner.sortOrder || index + 1}
                      </p>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {/* Reorder Arrows */}
                    <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800">
                      <button
                        type="button"
                        disabled={isFirst}
                        onClick={() => handleMoveUp(index)}
                        className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        title="Geser ke Atas"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isLast}
                        onClick={() => handleMoveDown(index)}
                        className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        title="Geser ke Bawah"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Toggle Active */}
                    <button
                      type="button"
                      onClick={() => handleToggleActive(banner.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer border ${
                        banner.isActive !== false
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                          : 'bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-400 border-emerald-800/50'
                      }`}
                    >
                      {banner.isActive !== false ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>

                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(banner)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700"
                      title="Edit Banner"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteBanner(banner.id)}
                      className="p-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 transition-colors cursor-pointer border border-rose-800/40"
                      title="Hapus Banner"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Form for Add / Edit Promo Banner */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-white my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Images className="w-5 h-5 text-[#00E5FF]" />
                <h3 className="font-display font-bold text-base uppercase">
                  {editingBanner ? 'Edit Promo Banner' : 'Tambah Promo Banner Baru'}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModalForm} className="space-y-4">
              {uploadError && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Image Upload Area */}
              <div className="space-y-2">
                <label className="block text-xs font-mono uppercase text-slate-300 font-semibold">
                  Foto Banner Landscape <span className="text-rose-400">*</span>
                </label>

                <div className="aspect-[16/8] sm:aspect-[16/7] rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden relative flex flex-col items-center justify-center p-4">
                  {formImageUrl ? (
                    <>
                      <img
                        src={resolveMediaUrl(formImageUrl)}
                        alt="Preview Banner"
                        className="w-full h-full object-cover rounded-xl"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-900 text-white text-xs font-mono border border-slate-700 shadow-md flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-[#00E5FF]" />
                        <span>Ganti Foto</span>
                      </button>
                    </>
                  ) : (
                    <div className="text-center space-y-2">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 text-[#00E5FF] flex items-center justify-center mx-auto">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">Upload Foto Promo</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Rasio landscape 16:7 / 16:8 (Maks. 10MB)</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="px-4 py-2 rounded-xl bg-[#00E5FF] text-slate-950 font-bold text-xs uppercase cursor-pointer"
                      >
                        {isUploading ? 'Mengunggah...' : 'Pilih Gambar'}
                      </button>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Title & Subtitle */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-300 font-semibold mb-1">
                    Judul Banner / Nama Promo (Opsional)
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Contoh: Promo Ramadan, Promo Weekend, Buy 1 Get 1..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-[#00E5FF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-slate-300 font-semibold mb-1">
                    Subtitle / Keterangan Singkat (Opsional)
                  </label>
                  <input
                    type="text"
                    value={formSubtitle}
                    onChange={(e) => setFormSubtitle(e.target.value)}
                    placeholder="Contoh: Diskon 20% khusus dine in..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-[#00E5FF]"
                  />
                </div>
              </div>

              {/* Sort Order & Active Toggle */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-300 font-semibold mb-1">
                    Urutan Tampil
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formSortOrder}
                    onChange={(e) => setFormSortOrder(parseInt(e.target.value) || 1)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-[#00E5FF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-slate-300 font-semibold mb-1">
                    Status Tayang
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormIsActive(!formIsActive)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold font-mono transition-colors flex items-center justify-center gap-2 cursor-pointer border ${
                      formIsActive
                        ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    {formIsActive ? <Check className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    <span>{formIsActive ? 'Aktif di Web' : 'Disembunyikan'}</span>
                  </button>
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !formImageUrl}
                  className="px-6 py-2 rounded-xl bg-[#00E5FF] hover:bg-[#3cf0ff] text-slate-950 font-bold text-xs uppercase cursor-pointer disabled:opacity-50"
                >
                  {editingBanner ? 'Simpan Perubahan' : 'Tambahkan Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
