export default function TrainerProgramNameField({
  monthProgram,
  updateMonthProgramName
}) {
  return (
    <label className="monthProgramEditorNameField">
      <span>Название программы</span>
      <input
        value={monthProgram.name || ""}
        onChange={(event) => updateMonthProgramName(event.target.value)}
        placeholder="Название программы"
      />
    </label>
  );
}
