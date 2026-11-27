import { Calendar, ChevronLeft, ChevronRight } from "../icons";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function localDay(date: Date) {
  return [String(date.getFullYear()).padStart(4, "0"), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export function TaskDate({ label, value, min, max, onChange, className = "v3-property-date", placeholder = "未设置" }: {
  label: string; value: string; min?: string; max?: string; className?: string; placeholder?: string; onChange: (day: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [month, setMonth] = useState(() => new Date());
  const [error, setError] = useState("");
  const year = month.getFullYear(), index = month.getMonth();
  const offset = (new Date(year, index, 1).getDay() + 6) % 7;
  const count = new Date(year, index + 1, 0).getDate();
  const select = (day: string) => {
    const parsed = new Date(day + "T12:00:00");
    if (day && (!/^\d{4}-\d{2}-\d{2}$/.test(day) || localDay(parsed) !== day)) {
      setError("请输入有效日期 YYYY-MM-DD");
      return;
    }
    if (day && ((min && day < min) || (max && day > max))) {
      setError("截止日期不能早于开始日期");
      return;
    }
    if (day !== value) onChange(day);
    setOpen(false);
  };
  return <Popover open={open} onOpenChange={next => {
    if (next) {
      setDraft(value);
      setError("");
      setMonth(value ? new Date(value + "T12:00:00") : new Date());
    }
    setOpen(next);
  }}>
    <PopoverTrigger className={className} aria-label={label}>
      <Calendar size={13}/>{value || placeholder}
    </PopoverTrigger>
    <PopoverContent className="v3-date-calendar" align="end" aria-label={label + "选择"}>
      <input aria-label={"输入" + label} value={draft} placeholder="YYYY-MM-DD"
        onChange={e => {setDraft(e.target.value);setError("");}}
        onKeyDown={e => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); select(draft.trim()); }
        }}/>
      {error && <p role="alert">{error}</p>}
      <header>
        <button type="button" aria-label="上个月" onClick={() => setMonth(new Date(year,index-1,1))}><ChevronLeft size={16}/></button>
        <strong>{year}年 {index+1}月</strong>
        <button type="button" aria-label="下个月" onClick={() => setMonth(new Date(year,index+1,1))}><ChevronRight size={16}/></button>
      </header>
      <div className="v3-calendar-grid">
        {["一","二","三","四","五","六","日"].map(name => <small key={name}>{name}</small>)}
        {Array.from({length:offset}, (_,i) => <span key={"blank"+i}/>)}
        {Array.from({length:count}, (_,i) => {
          const date = localDay(new Date(year,index,i+1));
          return <button type="button" key={date} aria-label={date} aria-pressed={date===value} onClick={() => select(date)}>{i+1}</button>;
        })}
      </div>
      <footer><button type="button" onClick={() => select(localDay(new Date()))}>今天</button>
        <button type="button" onClick={() => select("")}>清除日期</button></footer>
    </PopoverContent>
  </Popover>;
}
