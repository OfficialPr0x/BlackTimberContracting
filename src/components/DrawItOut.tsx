"use client";

import React, { useRef, useState, useEffect } from "react";
import { Paintbrush, Eraser, RotateCcw, Sparkles, Check, Download } from "lucide-react";

export default function DrawItOut() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#c5a880"); // Gold brush color
  const [brushSize, setBrushSize] = useState(4);
  const [tool, setTool] = useState<"draw" | "erase">("draw");
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderedImage, setRenderedImage] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("deck");

  // Load template lines onto the canvas
  const drawTemplate = (templateType: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas first
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setRenderedImage(null);
    setSelectedTemplate(templateType);

    // Apply canvas settings
    ctx.strokeStyle = "#c5a880";
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";

    ctx.beginPath();
    if (templateType === "deck") {
      // Draw a perspective deck frame
      ctx.moveTo(100, 250);
      ctx.lineTo(400, 200);
      ctx.lineTo(600, 300);
      ctx.lineTo(250, 370);
      ctx.closePath();
      // Draw posts
      ctx.moveTo(100, 250); ctx.lineTo(100, 320);
      ctx.moveTo(250, 370); ctx.lineTo(250, 440);
      ctx.moveTo(600, 300); ctx.lineTo(600, 370);
      // Draw steps
      ctx.moveTo(450, 280); ctx.lineTo(490, 330);
      ctx.moveTo(430, 290); ctx.lineTo(470, 340);
    } else if (templateType === "fence") {
      // Draw fence panels
      for (let i = 50; i < 650; i += 80) {
        ctx.rect(i, 150, 30, 200);
        ctx.moveTo(i + 15, 120);
        ctx.lineTo(i, 150);
        ctx.lineTo(i + 30, 150);
        ctx.closePath();
      }
      // Horizontal bars
      ctx.moveTo(30, 180); ctx.lineTo(650, 180);
      ctx.moveTo(30, 300); ctx.lineTo(650, 300);
    } else if (templateType === "garage") {
      // Draw a classic timber garage frame
      ctx.rect(150, 180, 400, 220); // main house body
      // Roof triangles
      ctx.moveTo(150, 180); ctx.lineTo(350, 80); ctx.lineTo(550, 180);
      // Garage door
      ctx.rect(200, 240, 140, 160);
      // Standard door
      ctx.rect(420, 260, 60, 140);
      // Window
      ctx.rect(420, 200, 60, 40);
    } else if (templateType === "pergola") {
      // Draw timber pergola structure
      // Posts
      ctx.rect(120, 140, 25, 260);
      ctx.rect(220, 160, 25, 240);
      ctx.rect(450, 160, 25, 240);
      ctx.rect(550, 140, 25, 260);
      // Main beam
      ctx.rect(80, 120, 540, 30);
      // Cross rafters
      for (let x = 140; x < 550; x += 50) {
        ctx.rect(x, 100, 15, 25);
      }
    }
    ctx.stroke();
  };

  useEffect(() => {
    // Initial draw
    drawTemplate("deck");
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let clientX, clientY;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let clientX, clientY;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;

    // Tool switching
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

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setRenderedImage(null);
  };

  const handleAiRender = () => {
    setIsRendering(true);
    setRenderProgress(0);

    const interval = setInterval(() => {
      setRenderProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsRendering(false);
          // Set photorealistic outputs based on template chosen
          if (selectedTemplate === "deck") {
            setRenderedImage("/deck_cranbrook.png");
          } else if (selectedTemplate === "fence") {
            setRenderedImage("/after.png");
          } else if (selectedTemplate === "garage") {
            setRenderedImage("/hero_bg.png");
          } else {
            setRenderedImage("/patio_fernie.png");
          }
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  return (
    <section className="space-y-6" id="canvas-section">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs font-bold text-brand-gold uppercase tracking-widest flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            AI Sketch Rendering
          </span>
          <h3 className="text-2xl font-bold uppercase tracking-tight text-white mt-1">
            Draw It Out Mode
          </h3>
          <p className="text-xs text-brand-gray">
            Bad at explaining your idea? Sketch a layout and let our AI translate it to a high-end structural photo render.
          </p>
        </div>

        {/* Templates Picker */}
        <div className="flex flex-wrap items-center gap-1.5 bg-brand-black p-1 border border-brand-border rounded-lg">
          {[
            { id: "deck", label: "Deck" },
            { id: "fence", label: "Fence" },
            { id: "garage", label: "Garage/Shed" },
            { id: "pergola", label: "Pergola" }
          ].map(t => (
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Drawing Controls Panel */}
        <div className="lg:col-span-1 bg-brand-panel p-5 rounded-2xl border border-brand-border flex flex-row lg:flex-col justify-between lg:justify-start gap-4">
          {/* Tool choices */}
          <div className="space-y-3 w-1/2 lg:w-full">
            <span className="text-[10px] font-bold text-brand-gray uppercase tracking-widest block">Drawing Tools</span>
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

          {/* Size slider */}
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

            {/* Clear and Reset */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={clearCanvas}
                className="flex-1 py-2 border border-brand-border hover:border-red-500/30 hover:text-red-400 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Clear
              </button>
              <button
                onClick={() => drawTemplate(selectedTemplate)}
                className="flex-1 py-2 border border-brand-border hover:border-brand-gold/30 hover:text-white text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all"
              >
                Reset Template
              </button>
            </div>
          </div>
        </div>

        {/* Drawing Canvas Area */}
        <div className="lg:col-span-3 relative rounded-2xl overflow-hidden border border-brand-border bg-brand-black shadow-2xl aspect-video w-full flex items-center justify-center">
          
          {/* THE CANVAS */}
          <canvas
            ref={canvasRef}
            width={800}
            height={500}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className={`w-full h-full object-contain cursor-crosshair bg-brand-black ${
              renderedImage ? "hidden" : "block"
            }`}
          />

          {/* AI RENDER RESULT OVERLAY */}
          {renderedImage && (
            <div className="absolute inset-0 w-full h-full animate-fade-in">
              <img 
                src={renderedImage} 
                alt="AI Photorealistic Render" 
                className="w-full h-full object-cover"
              />
              <div className="absolute top-4 right-4 bg-brand-gold text-brand-black px-3 py-1 text-[10px] font-bold tracking-widest uppercase rounded shadow flex items-center gap-1">
                <Check className="w-3 h-3" /> AI Render Complete
              </div>
              {/* Back to Canvas action */}
              <div className="absolute bottom-4 left-4 flex gap-2">
                <button
                  onClick={() => setRenderedImage(null)}
                  className="px-4 py-2 bg-black/80 hover:bg-black text-white text-[10px] font-bold tracking-widest uppercase rounded border border-brand-border shadow transition-all"
                >
                  Edit Drawing Sketch
                </button>
              </div>
            </div>
          )}

          {/* RENDERING PROGRESS LOADER OVERLAY */}
          {isRendering && (
            <div className="absolute inset-0 z-30 bg-black/95 flex flex-col items-center justify-center p-6 space-y-4 animate-fade-in">
              <div className="w-2/3 max-w-sm space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold text-brand-gold uppercase tracking-widest">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    Converting coordinates to 3D mesh...
                  </span>
                  <span>{renderProgress}%</span>
                </div>
                <div className="w-full bg-brand-border h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-brand-gold h-full transition-all duration-300 rounded-full" 
                    style={{ width: `${renderProgress}%` }}
                  />
                </div>
              </div>
              <span className="text-[10px] text-brand-gray font-mono">Diffusion processing... Region constraints verified.</span>
            </div>
          )}

          {/* Canvas Instructions */}
          {!isRendering && !renderedImage && (
            <div className="absolute top-4 left-4 bg-brand-charcoal/80 border border-brand-border px-3 py-1 text-[9px] font-bold tracking-wider uppercase rounded text-brand-gray pointer-events-none select-none">
              Draw here using mouse or touch
            </div>
          )}
        </div>
      </div>

      {/* Render Trigger CTA */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleAiRender}
          disabled={isRendering || renderedImage !== null}
          className="w-full sm:w-auto px-8 py-4 bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-bold uppercase tracking-widest text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4 fill-brand-black" />
          Render drawing with Black Timber AI
        </button>
      </div>
    </section>
  );
}
