const KOOTENAY_MAP_URL =
  "https://res.cloudinary.com/dkc1pmbma/image/upload/q_auto/f_auto/v1781151810/ChatGPT_Image_Jun_10_2026_10_21_52_PM_vm8qjj.png";

export default function LiveMap() {
  return (
    <div className="w-full aspect-video rounded-xl overflow-hidden bg-brand-black">
      <img
        src={KOOTENAY_MAP_URL}
        alt="Black Timber active jobsite map — Kootenays, British Columbia"
        className="w-full h-full object-contain"
        draggable={false}
      />
    </div>
  );
}
