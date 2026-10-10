import {useEffect,useRef,useState} from "react";
import {confirmPersonalNutritionBasis} from "../../../utils/personalNutritionFood.js";
import styles from "./FoodNutritionBasisDialog.module.css";

export default function FoodNutritionBasisDialog({food,onClose,onConfirm}) {
  const ref=useRef(null);
  const [amount,setAmount]=useState("100");
  const [unit,setUnit]=useState("g");
  useEffect(()=>{if(food)ref.current?.showModal();},[food]);
  if(!food)return null;
  const confirmed=confirmPersonalNutritionBasis(food,amount,unit);
  return <dialog ref={ref} className={styles.dialog} aria-labelledby="nutrition-basis-title" onCancel={onClose}>
    <button className={styles.close} type="button" aria-label="Закрыть уточнение КБЖУ" onClick={onClose}>×</button>
    <h2 id="nutrition-basis-title">К какому количеству относятся КБЖУ?</h2>
    <p>{food.name}</p>
    <p>В карточке: {food.calories} ккал · Б {food.protein} · Ж {food.fat} · У {food.carbs}. Масса или объём не указаны.</p>
    <div className={styles.fields}>
      <label>Количество<input type="number" min="0.1" step="any" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
      <label>Единица<select value={unit} onChange={e=>setUnit(e.target.value)}><option value="g">Граммы</option><option value="ml">Миллилитры</option></select></label>
    </div>
    <p>Укажите количество для приведённых значений — например, 100 г или стакан 300 мл. Порцию выберете дальше.</p>
    <button className={styles.confirm} type="button" disabled={!confirmed} onClick={()=>onConfirm(confirmed)}>Использовать эти значения</button>
  </dialog>;
}
