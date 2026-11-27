import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";

const colors = [
  ["蓝色", "#317fe3"],
  ["紫色", "#9674cc"],
  ["绿色", "#49a58b"],
  ["橙色", "#d0a04d"],
];
export function WorkspaceAvatar({
  value,
  name,
  onChange,
  reading,
  setReading,
  disabled = false,
  label = "团队头像",
}: {
  label?: string;
  value: string;
  name: string;
  onChange: (url: string) => void;
  reading: boolean;
  setReading: (v: boolean) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  async function choose(file?: File) {
    if (!file) return;
    setError("");
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError("请选择 5 MB 以内的 PNG、JPEG 或 WebP 图片");
      return;
    }
    setReading(true);
    try {
      const bitmap = await createImageBitmap(file);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 128;
        const side = Math.min(bitmap.width, bitmap.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw Error("无法处理图片");
        ctx.drawImage(
          bitmap,
          (bitmap.width - side) / 2,
          (bitmap.height - side) / 2,
          side,
          side,
          0,
          0,
          128,
          128,
        );
        onChange(canvas.toDataURL("image/webp", 0.86));
      } finally {
        bitmap.close();
      }
    } catch {
      setError("图片无法读取，请重新选择");
    } finally {
      setReading(false);
    }
  }
  function setColor(color: string) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = "white";
    ctx.font = "600 66px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText([...name.trim()][0] || "团", 64, 68);
    onChange(canvas.toDataURL("image/png"));
    setError("");
  }
  return (
    <div>
      <div className="tm-avatar-editor">
        <button
          type="button"
          className="tm-avatar-upload"
          disabled={disabled || reading}
          aria-label="选择头像图片"
          onClick={() => input.current?.click()}
        >
          <span className="tm-avatar">
            {value ? (
              <img src={value} alt="头像预览" />
            ) : (
              [...name.trim()][0] || "团"
            )}
          </span>
          <span>
            <ImagePlus size={15} />
          </span>
        </button>
        <div>
          <strong>{label}</strong>
          <p>选择颜色，或上传团队标识</p>
          <div className="tm-avatar-colors">
            {colors.map(([text, color]) => (
              <button
                key={text}
                style={{ background: color }}
                type="button"
                disabled={reading || disabled}
                aria-label={"使用" + text + "头像"}
                onClick={() => setColor(color)}
              />
            ))}
            {value && !disabled && (
              <button
                className="tm-text-button"
                type="button"
                disabled={reading}
                onClick={() => onChange("")}
              >
                移除图片
              </button>
            )}
          </div>
        </div>
        <input
          type="file"
          hidden
          ref={input}
          aria-label={"上传" + label}
          accept="image/png,image/jpeg,image/webp"
          disabled={reading || disabled}
          onChange={(event) => {
            void choose(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
      {error && (
        <p role="alert" className="tm-error">
          {error}
        </p>
      )}
    </div>
  );
}
