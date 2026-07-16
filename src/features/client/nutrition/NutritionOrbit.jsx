import styles from "./NutritionOrbit.module.css";

export default function NutritionOrbit({
  items,
  onAdd
}) {
  return (
    <section
      className={styles.root}
      aria-label="Добавить еду"
      data-testid="nutrition-orbit"
      data-css-module-scope="nutrition-orbit"
    >
      <div className={styles.card} data-nutrition-orbit-part="card">
        <div className={styles.stage} data-nutrition-orbit-part="stage">
          <svg className={styles.scene} viewBox="0 0 540 463" aria-hidden="true" data-nutrition-orbit-part="scene">
            <defs>
              <filter id="nutritionOrbitSoftShadow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="13" stdDeviation="13" floodColor="#2f3a68" floodOpacity="0.13" />
              </filter>
              <filter id="nutritionOrbitAddShadow" x="-35%" y="-35%" width="170%" height="170%">
                <feDropShadow dx="0" dy="13" stdDeviation="12" floodColor="#4c2be1" floodOpacity="0.25" />
              </filter>
              <radialGradient id="nutritionOrbitProteinFill" cx="50%" cy="50%" r="62%">
                <stop offset="0%" stopColor="#fff1f2" />
                <stop offset="100%" stopColor="#ffffff" />
              </radialGradient>
              <radialGradient id="nutritionOrbitFatFill" cx="50%" cy="50%" r="62%">
                <stop offset="0%" stopColor="#fff8e6" />
                <stop offset="100%" stopColor="#ffffff" />
              </radialGradient>
              <radialGradient id="nutritionOrbitCarbsFill" cx="50%" cy="50%" r="62%">
                <stop offset="0%" stopColor="#eef7ff" />
                <stop offset="100%" stopColor="#ffffff" />
              </radialGradient>
              <radialGradient id="nutritionOrbitCaloriesFill" cx="50%" cy="50%" r="62%">
                <stop offset="0%" stopColor="#efffeb" />
                <stop offset="100%" stopColor="#ffffff" />
              </radialGradient>
              <linearGradient id="nutritionOrbitAddFill" x1="196" y1="134" x2="344" y2="274" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#8c67ff" />
                <stop offset="100%" stopColor="#4c25f1" />
              </linearGradient>
            </defs>

            <circle cx="270" cy="232" r="184" fill="none" stroke="#dfd9ff" strokeWidth="2.4" />
            {items.map((item) => (
              <path
                key={item.id}
                data-nutrition-orbit-progress={item.id}
                d={item.segment.progressPath}
                fill="none"
                stroke={item.color}
                strokeWidth="5.2"
                strokeLinecap="round"
              />
            ))}

            <circle className={styles.addHalo} data-nutrition-orbit-halo="outer" cx="270" cy="232" r="128" fill="#684cf6" opacity="0.055" />
            <circle className={`${styles.addHalo} ${styles.middle}`} data-nutrition-orbit-halo="middle" cx="270" cy="232" r="96" fill="#684cf6" opacity="0.075" />
            <circle className={`${styles.addHalo} ${styles.inner}`} data-nutrition-orbit-halo="inner" cx="270" cy="232" r="72" fill="#684cf6" opacity="0.09" />
            <circle className={styles.addCore} data-nutrition-orbit-part="core" cx="270" cy="232" r="58" fill="url(#nutritionOrbitAddFill)" filter="url(#nutritionOrbitAddShadow)" />
            <path className={styles.addPlus} data-nutrition-orbit-part="plus" d="M270 200v64M238 232h64" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" />

            {items.map((item) => (
              <g key={`${item.id}-dots`}>
                {item.segment.hasProgress && (
                  <circle cx={item.segment.progressDot.x} cy={item.segment.progressDot.y} r="8" fill={item.color} />
                )}
              </g>
            ))}

            <g filter="url(#nutritionOrbitSoftShadow)" transform="translate(118 101) scale(0.8929) translate(-118 -101)">
              <circle cx="118" cy="101" r="54" fill="url(#nutritionOrbitCaloriesFill)" stroke="#ffffff" strokeWidth="6" />
              <text x="118" y="80" textAnchor="middle" className={styles.label} data-nutrition-orbit-text="label" fill={items[0].color}>{items[0].label}</text>
              <text x="118" y="112" textAnchor="middle" className={styles.amount} data-nutrition-orbit-text="amount">{items[0].amount}</text>
              <text x="118" y="140" textAnchor="middle" className={styles.target} data-nutrition-orbit-text="target">{items[0].target}</text>
            </g>
            <g filter="url(#nutritionOrbitSoftShadow)" transform="translate(432 101) scale(0.8929) translate(-432 -101)">
              <circle cx="432" cy="101" r="54" fill="url(#nutritionOrbitProteinFill)" stroke="#ffffff" strokeWidth="6" />
              <text x="432" y="80" textAnchor="middle" className={styles.label} data-nutrition-orbit-text="label" fill={items[1].color}>{items[1].label}</text>
              <text x="432" y="112" textAnchor="middle" className={styles.amount} data-nutrition-orbit-text="amount">{items[1].amount}</text>
              <text x="432" y="140" textAnchor="middle" className={styles.target} data-nutrition-orbit-text="target">{items[1].target}</text>
            </g>
            <g filter="url(#nutritionOrbitSoftShadow)" transform="translate(114 370) scale(0.8929) translate(-114 -370)">
              <circle cx="114" cy="370" r="54" fill="url(#nutritionOrbitCarbsFill)" stroke="#ffffff" strokeWidth="6" />
              <text x="114" y="349" textAnchor="middle" className={styles.label} data-nutrition-orbit-text="label" fill={items[2].color}>{items[2].label}</text>
              <text x="114" y="381" textAnchor="middle" className={styles.amount} data-nutrition-orbit-text="amount">{items[2].amount}</text>
              <text x="114" y="409" textAnchor="middle" className={styles.target} data-nutrition-orbit-text="target">{items[2].target}</text>
            </g>
            <g filter="url(#nutritionOrbitSoftShadow)" transform="translate(432 370) scale(0.8929) translate(-432 -370)">
              <circle cx="432" cy="370" r="54" fill="url(#nutritionOrbitFatFill)" stroke="#ffffff" strokeWidth="6" />
              <text x="432" y="349" textAnchor="middle" className={styles.label} data-nutrition-orbit-text="label" fill={items[3].color}>{items[3].label}</text>
              <text x="432" y="381" textAnchor="middle" className={styles.amount} data-nutrition-orbit-text="amount">{items[3].amount}</text>
              <text x="432" y="409" textAnchor="middle" className={styles.target} data-nutrition-orbit-text="target">{items[3].target}</text>
            </g>

            <text x="270" y="334" textAnchor="middle" className={styles.title} data-nutrition-orbit-text="title">Добавить еду</text>
            <text x="270" y="360" textAnchor="middle" className={styles.subtitle} data-nutrition-orbit-text="subtitle">
              <tspan x="270" dy="0">Нажмите, чтобы добавить</tspan>
              <tspan x="270" dy="18">продукты и записать приём пищи</tspan>
            </text>
          </svg>
          <button
            type="button"
            className={styles.hitButton}
            onClick={onAdd}
            aria-label="Добавить еду"
            data-testid="nutrition-orbit-add"
          />
        </div>
      </div>
    </section>
  );
}
