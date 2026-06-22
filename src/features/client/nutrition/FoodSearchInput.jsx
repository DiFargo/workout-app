export default function FoodSearchInput({
  value,
  onChange,
  onReset
}) {
  return (
    <div className="fatSearchInputWrapPremium">
      <span>⌕</span>
      <input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        placeholder="Поиск еды, бренда или блюда..."
      />
      {value && (
        <button type="button" onClick={onReset} aria-label="Сбросить поиск">
          ×
        </button>
      )}
    </div>
  );
}
