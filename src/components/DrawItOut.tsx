"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  Paintbrush,
  Eraser,
  RotateCcw,
  Sparkles,
  Check,
  Upload,
  X,
  ImageIcon,
  Ruler,
} from "lucide-react";
import { PROJECT_STYLES, type ProjectTemplate } from "@/lib/openrouter/project-styles";

type Template = ProjectTemplate;

interface AiMockupResult {
  interpretation: string;
  detectedFeatures: string[];
  approximateDimensions: { length: number; width: number; notes?: string };
  designNotes: string;
  recommendedUpgrades: string[];
  generatedMockupUrl: string;
  styleLabel: string;
  isConceptRender: boolean;
  visionFallback?: boolean;
}

const CANVAS_W = 800;
const CANVAS_H = 500;

export default function DrawItOut() {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const sitePhotoImageRef = useRef<HTMLImageElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color] = useState("#c5a880");
  const [brushSize, setBrushSize] = useState(4);
  const [tool, setTool] = useState<"draw" | "erase">("draw");
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderedImage, setRenderedImage] = useState<string | null>(null);
  const [renderResult, setRenderResult] = useState<AiMockupResult | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template>("deck");
  const [selectedStyle, setSelectedStyle] = useState(PROJECT_STYLES.deck[0]!.id);
  const [lengthFt, setLengthFt] = useState("");
  const [widthFt, setWidthFt] = useState("");
  const [corners, setCorners] = useState("0");
  const [gates, setGates] = useState("0");
  const [intent, setIntent] = useState("");
  const [sitePhoto, setSitePhoto] = useState<{ name: string; dataUrl: string } | null>(null);

  const stylesForTemplate = PROJECT_STYLES[selectedTemplate];

  useEffect(() => {
    const first = PROJECT_STYLES[selectedTemplate][0];
    if (first) setSelectedStyle(first.id);
  }, [selectedTemplate]);

  const paintBackground = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    const img = sitePhotoImageRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      const scale = Math.max(CANVAS_W / img.naturalWidth, CANVAS_H / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      const x = (CANVAS_W - w) / 2;
      const y = (CANVAS_H - h) / 2;
      ctx.drawImage(img, x, y, w, h);
    } else {
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
  };

  const refreshBackground = () => {
    const bg = bgCanvasRef.current;
    if (!bg) return;
    const ctx = bg.getContext("2d");
    if (!ctx) return;
    paintBackground(ctx);
  };

  const clearDrawLayer = () => {
    const draw = drawCanvasRef.current;
    if (!draw) return;
    const ctx = draw.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  };

  const strokeTemplate = (ctx: CanvasRenderingContext2D, templateType: Template) => {
    ctx.strokeStyle = "#c5a880";
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.globalCompositeOperation = "source-over";

    ctx.beginPath();
    if (templateType === "deck") {
      ctx.moveTo(100, 250);
      ctx.lineTo(400, 200);
      ctx.lineTo(600, 300);
      ctx.lineTo(250, 370);
      ctx.closePath();
      ctx.moveTo(100, 250); ctx.lineTo(100, 320);
      ctx.moveTo(250, 370); ctx.lineTo(250, 440);
      ctx.moveTo(600, 300); ctx.lineTo(600, 370);
      ctx.moveTo(450, 280); ctx.lineTo(490, 330);
      ctx.moveTo(430, 290); ctx.lineTo(470, 340);
    } else if (templateType === "fence") {
      for (let i = 50; i < 650; i += 80) {
        ctx.rect(i, 150, 30, 200);
        ctx.moveTo(i + 15, 120);
        ctx.lineTo(i, 150);
        ctx.lineTo(i + 30, 150);
        ctx.closePath();
      }
      ctx.moveTo(30, 180); ctx.lineTo(650, 180);
      ctx.moveTo(30, 300); ctx.lineTo(650, 300);
      ctx.moveTo(50, 150); ctx.lineTo(50, 350);
      ctx.moveTo(50, 350); ctx.lineTo(200, 350);
    } else if (templateType === "garage") {
      ctx.rect(150, 180, 400, 220);
      ctx.moveTo(150, 180); ctx.lineTo(350, 80); ctx.lineTo(550, 180);
      ctx.rect(200, 240, 140, 160);
      ctx.rect(420, 260, 60, 140);
      ctx.rect(420, 200, 60, 40);
    } else if (templateType === "pergola") {
      ctx.rect(120, 140, 25, 260);
      ctx.rect(220, 160, 25, 240);
      ctx.rect(450, 160, 25, 240);
      ctx.rect(550, 140, 25, 260);
      ctx.rect(80, 120, 540, 30);
      for (let x = 140; x < 550; x += 50) {
        ctx.rect(x, 100, 15, 25);
      }
    }
    ctx.stroke();
  };

  const drawTemplate = (templateType: Template) => {
    setRenderedImage(null);
    setRenderResult(null);
    setRenderError(null);
    setSelectedTemplate(templateType);
    refreshBackground();
    clearDrawLayer();
    const draw = drawCanvasRef.current;
    if (!draw) return;
    const ctx = draw.getContext("2d");
    if (!ctx) return;
    strokeTemplate(ctx, templateType);
  };

  const loadSitePhotoOntoCanvas = (dataUrl: string, name: string) => {
    const img = new Image();
    img.onload = () => {
      sitePhotoImageRef.current = img;
      refreshBackground();
      clearDrawLayer();
      setRenderedImage(null);
      setRenderResult(null);
      setSitePhoto({ name, dataUrl });
    };
    img.src = dataUrl;
  };

  const removeSitePhoto = () => {
    sitePhotoImageRef.current = null;
    setSitePhoto(null);
    refreshBackground();
    clearDrawLayer();
    const draw = drawCanvasRef.current;
    if (draw) {
      const ctx = draw.getContext("2d");
      if (ctx) strokeTemplate(ctx, selectedTemplate);
    }
  };

  useEffect(() => {
    refreshBackground();
    const draw = drawCanvasRef.current;
    if (draw) {
      const ctx = draw.getContext("2d");
      if (ctx) strokeTemplate(ctx, "deck");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canvasPoint = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) => {
    let clientX: number;
    let clientY: number;
    if ("touches" in e) {
      clientX = e.touches[0]!.clientX;
      clientY = e.touches[0]!.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = canvasPoint(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = canvasPoint(e, canvas);

    if (tool === "draw") {
      ctx.strokeStyle = color;
      ctx.globalCompositeOperation = "source-over";
    } else {
      ctx.globalCompositeOperation = "destination-out";
    }

    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearDrawing = () => {
    clearDrawLayer();
    setRenderedImage(null);
    setRenderResult(null);
    setRenderError(null);
  };

  const exitRenderView = () => {
    setRenderedImage(null);
    setRenderResult(null);
    setRenderError(null);
  };

  const resetTemplate = () => {
    setRenderedImage(null);
    setRenderResult(null);
    setRenderError(null);
    refreshBackground();
    clearDrawLayer();
    const draw = drawCanvasRef.current;
    if (!draw) return;
    const ctx = draw.getContext("2d");
    if (!ctx) return;
    strokeTemplate(ctx, selectedTemplate);
  };

  const handleSitePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      loadSitePhotoOntoCanvas(reader.result as string, file.name);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const exportSketch = (): string | undefined => {
    const bg = bgCanvasRef.current;
    const draw = drawCanvasRef.current;
    if (!bg || !draw) return undefined;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = CANVAS_W;
    exportCanvas.height = CANVAS_H;
    const exportCtx = exportCanvas.getContext("2d");
    if (!exportCtx) return undefined;
    exportCtx.drawImage(bg, 0, 0);
    exportCtx.drawImage(draw, 0, 0);
    return exportCanvas.toDataURL("image/png");
  };

  const handleAiRender = async () => {
    if (!sitePhoto && !drawCanvasRef.current) return;

    setIsRendering(true);
    setRenderError(null);
    setRenderResult(null);

    try {
      const sketchDataUrl = exportSketch();
      if (!sketchDataUrl && !sitePhoto) {
        throw new Error("Sketch a layout or upload a photo of your yard first.");
      }

      const dimensions: Record<string, number> = {};
      const len = parseFloat(lengthFt);
      const wid = parseFloat(widthFt);
      const cornerCount = parseInt(corners, 10);
      const gateCount = parseInt(gates, 10);
      if (!Number.isNaN(len) && len > 0) dimensions.lengthFt = len;
      if (!Number.isNaN(wid) && wid > 0) dimensions.widthFt = wid;
      if (!Number.isNaN(cornerCount) && cornerCount >= 0) dimensions.corners = cornerCount;
      if (!Number.isNaN(gateCount) && gateCount >= 0) dimensions.gates = gateCount;

      const res = await fetch("/api/ai/draw-render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sketchDataUrl,
          sitePhotoDataUrl: sitePhoto?.dataUrl,
          template: selectedTemplate,
          style: selectedStyle,
          dimensions: Object.keys(dimensions).length ? dimensions : undefined,
          intent: intent.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: { message?: string } }));
        throw new Error(body?.error?.message ?? `Render failed (${res.status})`);
      }
      const data = (await res.json()) as AiMockupResult;
      setRenderResult(data);
      setRenderedImage(data.generatedMockupUrl);
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : "AI mockup generation failed");
    } finally {
      setIsRendering(false);
    }
  };

  const dimLabel =
    selectedTemplate === "fence"
      ? { length: "Total Run (ft)", width: "Height (ft)" }
      : selectedTemplate === "pergola"
        ? { length: "Length (ft)", width: "Depth (ft)" }
        : { length: "Length (ft)", width: "Width (ft)" };

  return (
    <section className="space-y-6" id="canvas-section">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs font-bold text-brand-gold uppercase tracking-widest flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            AI Design Mockup
          </span>
          <h3 className="text-2xl font-bold uppercase tracking-tight text-white mt-1">
            Draw It Out Mode
          </h3>
          <p className="text-xs text-brand-gray max-w-lg">
            Pick your build style, sketch the layout, add measurements, and upload a photo of your
            yard — our AI generates a photorealistic concept of what it could look like in your space.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-brand-black p-1 border border-brand-border rounded-lg">
          {(
            [
              { id: "deck", label: "Deck" },
              { id: "fence", label: "Fence" },
              { id: "garage", label: "Garage/Shed" },
              { id: "pergola", label: "Pergola" },
            ] as const satisfies ReadonlyArray<{ id: Template; label: string }>
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => drawTemplate(t.id)}
              className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${
                selectedTemplate === t.id && !renderedImage
                  ? "bg-brand-gold text-brand-black"
                  : "text-brand-gray hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Style picker */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold text-brand-gray uppercase tracking-widest flex items-center gap-1.5">
          <ImageIcon className="w-3 h-3" />
          Build Style — {selectedTemplate}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {stylesForTemplate.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedStyle(s.id)}
              className={`px-3 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all ${
                selectedStyle === s.id
                  ? "border-brand-gold bg-brand-gold/15 text-white"
                  : "border-brand-border bg-brand-panel/40 text-brand-gray hover:text-white hover:border-brand-gold/30"
              }`}
            >
              {s.short}
            </button>
          ))}
        </div>
      </div>

      {/* Measurements + site photo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-brand-panel border border-brand-border rounded-xl p-4 space-y-3">
          <span className="text-[10px] font-bold text-brand-gold uppercase tracking-widest flex items-center gap-1.5">
            <Ruler className="w-3 h-3" />
            Measurements
          </span>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-[9px] font-bold text-brand-gray uppercase tracking-wider">
                {dimLabel.length}
              </span>
              <input
                type="number"
                min="0"
                value={lengthFt}
                onChange={(e) => setLengthFt(e.target.value)}
                placeholder="e.g. 120"
                className="w-full bg-brand-black border border-brand-border focus:border-brand-gold focus:outline-none rounded-lg px-3 py-2 text-sm text-white font-mono"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[9px] font-bold text-brand-gray uppercase tracking-wider">
                {dimLabel.width}
              </span>
              <input
                type="number"
                min="0"
                value={widthFt}
                onChange={(e) => setWidthFt(e.target.value)}
                placeholder={selectedTemplate === "fence" ? "e.g. 6" : "e.g. 16"}
                className="w-full bg-brand-black border border-brand-border focus:border-brand-gold focus:outline-none rounded-lg px-3 py-2 text-sm text-white font-mono"
              />
            </label>
            {selectedTemplate === "fence" && (
              <>
                <label className="space-y-1">
                  <span className="text-[9px] font-bold text-brand-gray uppercase tracking-wider">
                    Corners
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={corners}
                    onChange={(e) => setCorners(e.target.value)}
                    className="w-full bg-brand-black border border-brand-border focus:border-brand-gold focus:outline-none rounded-lg px-3 py-2 text-sm text-white font-mono"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[9px] font-bold text-brand-gray uppercase tracking-wider">
                    Gates
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={gates}
                    onChange={(e) => setGates(e.target.value)}
                    className="w-full bg-brand-black border border-brand-border focus:border-brand-gold focus:outline-none rounded-lg px-3 py-2 text-sm text-white font-mono"
                  />
                </label>
              </>
            )}
          </div>
          <label className="space-y-1 block">
            <span className="text-[9px] font-bold text-brand-gray uppercase tracking-wider">
              Extra notes (optional)
            </span>
            <input
              type="text"
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="e.g. slope to the east, wrap around the hot tub…"
              className="w-full bg-brand-black border border-brand-border focus:border-brand-gold focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
            />
          </label>
        </div>

        <div className="bg-brand-panel border border-brand-border rounded-xl p-4 space-y-3">
          <span className="text-[10px] font-bold text-brand-gold uppercase tracking-widest flex items-center gap-1.5">
            <Upload className="w-3 h-3" />
            Your Yard / Space Photo
          </span>
          <p className="text-[10px] text-brand-gray leading-relaxed">
            Upload a photo of your yard — it loads into the draw canvas so you can sketch directly on
            your space. The AI uses the same photo for the final mockup.
          </p>
          {!sitePhoto ? (
            <div className="border-2 border-dashed border-brand-border hover:border-brand-gold/40 rounded-xl p-6 text-center relative cursor-pointer transition-all">
              <input
                type="file"
                accept="image/*"
                onChange={handleSitePhotoUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Upload className="w-8 h-8 text-brand-gold mx-auto mb-2" />
              <p className="text-[10px] font-bold text-white uppercase tracking-wider">
                Drop yard photo here or click to browse
              </p>
              <p className="text-[9px] text-brand-gray mt-1">PNG / JPG — draws onto the canvas</p>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-brand-gold/30 bg-brand-gold/5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-14 h-10 rounded border border-brand-border overflow-hidden shrink-0">
                  <img
                    src={sitePhoto.dataUrl}
                    alt={sitePhoto.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-brand-gold uppercase tracking-wider truncate">
                    Loaded in draw canvas
                  </p>
                  <p className="text-[9px] text-brand-gray truncate">{sitePhoto.name}</p>
                </div>
              </div>
              <button
                onClick={removeSitePhoto}
                className="shrink-0 p-1.5 rounded-full border border-brand-border hover:border-red-500/40 hover:text-red-400 transition-colors"
                title="Remove photo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 bg-brand-panel p-5 rounded-2xl border border-brand-border flex flex-row lg:flex-col justify-between lg:justify-start gap-4">
          <div className="space-y-3 w-1/2 lg:w-full">
            <span className="text-[10px] font-bold text-brand-gray uppercase tracking-widest block">
              Drawing Tools
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setTool("draw")}
                className={`flex-1 py-2.5 rounded-lg border text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                  tool === "draw"
                    ? "border-brand-gold bg-brand-gold/5 text-white"
                    : "border-brand-border text-brand-gray hover:text-white"
                }`}
              >
                <Paintbrush className="w-3.5 h-3.5" />
                Draw
              </button>
              <button
                onClick={() => setTool("erase")}
                className={`flex-1 py-2.5 rounded-lg border text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                  tool === "erase"
                    ? "border-brand-gold bg-brand-gold/5 text-white"
                    : "border-brand-border text-brand-gray hover:text-white"
                }`}
              >
                <Eraser className="w-3.5 h-3.5" />
                Erase
              </button>
            </div>
          </div>

          <div className="space-y-2 w-1/2 lg:w-full">
            <div className="flex justify-between items-center text-[10px] font-bold text-brand-gray uppercase tracking-widest">
              <span>Brush Thickness</span>
              <span className="text-brand-gold">{brushSize}px</span>
            </div>
            <input
              type="range"
              min="2"
              max="15"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-full h-1 bg-brand-border rounded-lg appearance-none cursor-pointer accent-brand-gold"
            />
            <div className="flex gap-2 pt-2">
              <button
                onClick={clearDrawing}
                className="flex-1 py-2 border border-brand-border hover:border-red-500/30 hover:text-red-400 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Clear Marks
              </button>
              <button
                onClick={resetTemplate}
                className="flex-1 py-2 border border-brand-border hover:border-brand-gold/30 hover:text-white text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all"
              >
                Reset Template
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 relative rounded-2xl overflow-hidden border border-brand-border bg-brand-black shadow-2xl aspect-video w-full flex items-center justify-center">
          <div
            className={`relative w-full h-full ${renderedImage ? "hidden" : "block"}`}
          >
            <canvas
              ref={bgCanvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            />
            <canvas
              ref={drawCanvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="absolute inset-0 w-full h-full object-contain cursor-crosshair"
            />
          </div>

          {renderedImage && (
            <div className="absolute inset-0 w-full h-full animate-fade-in">
              <img
                src={renderedImage}
                alt="AI concept mockup of your project"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/85 to-transparent p-4 sm:p-5 space-y-2">
                {renderResult && (
                  <>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-brand-gold flex items-center gap-1.5">
                      <Check className="w-3 h-3" />
                      {renderResult.styleLabel} · {renderResult.detectedFeatures.length} features
                    </div>
                    <p className="text-xs text-white leading-relaxed line-clamp-3">
                      {renderResult.designNotes}
                    </p>
                  </>
                )}
              </div>
              <div className="absolute top-4 right-4 px-3 py-1 text-[10px] font-bold tracking-widest uppercase rounded shadow flex items-center gap-1 bg-brand-gold text-brand-black">
                <Sparkles className="w-3 h-3" />
                AI Concept Render
              </div>
              <div className="absolute top-4 left-4">
                <button
                  onClick={exitRenderView}
                  className="px-4 py-2 bg-black/80 hover:bg-black text-white text-[10px] font-bold tracking-widest uppercase rounded border border-brand-border shadow transition-all"
                >
                  Edit &amp; Re-generate
                </button>
              </div>
            </div>
          )}

          {isRendering && (
            <div className="absolute inset-0 z-30 bg-black/95 flex flex-col items-center justify-center p-6 space-y-4 animate-fade-in">
              <Sparkles className="w-8 h-8 text-brand-gold animate-spin" />
              <div className="text-center space-y-1">
                <div className="text-[11px] font-bold text-brand-gold uppercase tracking-widest">
                  Generating your mockup…
                </div>
                <div className="text-[10px] text-brand-gray font-mono">
                  Reading layout · applying {stylesForTemplate.find((s) => s.id === selectedStyle)?.label ?? "style"} · rendering in your space
                </div>
              </div>
            </div>
          )}

          {!isRendering && !renderedImage && (
            <div className="absolute top-4 left-4 bg-brand-charcoal/80 border border-brand-border px-3 py-1 text-[9px] font-bold tracking-wider uppercase rounded text-brand-gray pointer-events-none select-none">
              {sitePhoto
                ? "Draw on your yard photo — gold marks show where the build goes"
                : "Sketch layout here · upload a yard photo to draw on your space"}
            </div>
          )}
        </div>
      </div>

      {renderResult && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 animate-slide-up">
          <div className="md:col-span-2 bg-brand-panel border border-brand-border rounded-xl p-4 space-y-2">
            <span className="text-[10px] font-bold text-brand-gold uppercase tracking-widest">
              What our AI understood
            </span>
            <p className="text-xs text-brand-gray leading-relaxed">{renderResult.interpretation}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {renderResult.detectedFeatures.map((f, i) => (
                <span
                  key={i}
                  className="text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border border-brand-border text-brand-gray"
                >
                  {f}
                </span>
              ))}
            </div>
            {renderResult.isConceptRender && (
              <p className="text-[10px] text-brand-gray/80 pt-2 italic">
                AI concept render — final build may vary after an on-site visit. Not a construction
                contract or permit drawing.
              </p>
            )}
          </div>
          <div className="bg-brand-panel border border-brand-border rounded-xl p-4 space-y-2">
            <span className="text-[10px] font-bold text-brand-gold uppercase tracking-widest">
              Size · upgrades to consider
            </span>
            <div className="text-xs text-white font-mono">
              {renderResult.approximateDimensions.length > 0 ||
              renderResult.approximateDimensions.width > 0
                ? `${renderResult.approximateDimensions.length} × ${renderResult.approximateDimensions.width} ft`
                : "Add measurements for better accuracy"}
            </div>
            <ul className="text-[11px] text-brand-gray space-y-1 pt-1">
              {renderResult.recommendedUpgrades.slice(0, 4).map((u, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-brand-gold mt-1.5 flex-shrink-0" />
                  <span>{u}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {renderError && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded p-3">
          {renderError}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          onClick={handleAiRender}
          disabled={isRendering || renderedImage !== null}
          className="w-full sm:w-auto px-8 py-4 bg-brand-gold hover:bg-brand-gold-hover disabled:opacity-50 disabled:cursor-not-allowed text-brand-black font-bold uppercase tracking-widest text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4 fill-brand-black" />
          {isRendering ? "Generating mockup…" : "Generate AI Mockup in My Space"}
        </button>
      </div>
    </section>
  );
}
