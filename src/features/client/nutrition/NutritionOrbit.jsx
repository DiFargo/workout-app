export default function NutritionOrbit({
  items,
  onAdd
}) {
  return (
    <section className="nutritionOrbitPreview" aria-label="Добавить еду">
      <div className="nutritionOrbitPreviewCard">
        <div className="nutritionOrbitStage">
          <svg className="nutritionOrbitScene" viewBox="0 0 540 463" aria-hidden="true">
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
                className={`nutritionOrbitProgressPath ${item.id}`}
                d={item.segment.progressPath}
                fill="none"
                stroke={item.color}
                strokeWidth="5.2"
                strokeLinecap="round"
              />
            ))}

            <circle className="nutritionOrbitAddHalo haloOuter" cx="270" cy="232" r="128" fill="#684cf6" opacity="0.055" />
            <circle className="nutritionOrbitAddHalo haloMiddle" cx="270" cy="232" r="96" fill="#684cf6" opacity="0.075" />
            <circle className="nutritionOrbitAddHalo haloInner" cx="270" cy="232" r="72" fill="#684cf6" opacity="0.09" />
            <circle className="nutritionOrbitAddCore" cx="270" cy="232" r="58" fill="url(#nutritionOrbitAddFill)" filter="url(#nutritionOrbitAddShadow)" />
            <path className="nutritionOrbitAddPlus" d="M270 200v64M238 232h64" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" />

            {items.map((item) => (
              <g key={`${item.id}-dots`}>
                {item.segment.hasProgress && (
                  <circle cx={item.segment.progressDot.x} cy={item.segment.progressDot.y} r="8" fill={item.color} />
                )}
              </g>
            ))}

            <g filter="url(#nutritionOrbitSoftShadow)" transform="translate(118 101) scale(0.8929) translate(-118 -101)">
              <circle cx="118" cy="101" r="54" fill="url(#nutritionOrbitCaloriesFill)" stroke="#ffffff" strokeWidth="6" />
              <text x="118" y="80" textAnchor="middle" className="nutritionOrbitSvgLabel" fill={items[0].color}>{items[0].label}</text>
              <text x="118" y="112" textAnchor="middle" className="nutritionOrbitSvgAmount">{items[0].amount}</text>
              <text x="118" y="140" textAnchor="middle" className="nutritionOrbitSvgTarget">{items[0].target}</text>
            </g>
            <g filter="url(#nutritionOrbitSoftShadow)" transform="translate(432 101) scale(0.8929) translate(-432 -101)">
              <circle cx="432" cy="101" r="54" fill="url(#nutritionOrbitProteinFill)" stroke="#ffffff" strokeWidth="6" />
              <text x="432" y="80" textAnchor="middle" className="nutritionOrbitSvgLabel" fill={items[1].color}>{items[1].label}</text>
              <text x="432" y="112" textAnchor="middle" className="nutritionOrbitSvgAmount">{items[1].amount}</text>
              <text x="432" y="140" textAnchor="middle" className="nutritionOrbitSvgTarget">{items[1].target}</text>
            </g>
            <g filter="url(#nutritionOrbitSoftShadow)" transform="translate(114 370) scale(0.8929) translate(-114 -370)">
              <circle cx="114" cy="370" r="54" fill="url(#nutritionOrbitCarbsFill)" stroke="#ffffff" strokeWidth="6" />
              <text x="114" y="349" textAnchor="middle" className="nutritionOrbitSvgLabel" fill={items[2].color}>{items[2].label}</text>
              <text x="114" y="381" textAnchor="middle" className="nutritionOrbitSvgAmount">{items[2].amount}</text>
              <text x="114" y="409" textAnchor="middle" className="nutritionOrbitSvgTarget">{items[2].target}</text>
            </g>
            <g filter="url(#nutritionOrbitSoftShadow)" transform="translate(432 370) scale(0.8929) translate(-432 -370)">
              <circle cx="432" cy="370" r="54" fill="url(#nutritionOrbitFatFill)" stroke="#ffffff" strokeWidth="6" />
              <text x="432" y="349" textAnchor="middle" className="nutritionOrbitSvgLabel" fill={items[3].color}>{items[3].label}</text>
              <text x="432" y="381" textAnchor="middle" className="nutritionOrbitSvgAmount">{items[3].amount}</text>
              <text x="432" y="409" textAnchor="middle" className="nutritionOrbitSvgTarget">{items[3].target}</text>
            </g>

            <text x="270" y="334" textAnchor="middle" className="nutritionOrbitSvgTitle">Добавить еду</text>
            <text x="270" y="360" textAnchor="middle" className="nutritionOrbitSvgSubtitle">
              <tspan x="270" dy="0">Нажмите, чтобы добавить</tspan>
              <tspan x="270" dy="18">продукты и записать приём пищи</tspan>
            </text>
          </svg>
          <button
            type="button"
            className="nutritionOrbitHitButton"
            onClick={onAdd}
            aria-label="Добавить еду"
          />
        </div>
      </div>
    </section>
  );
}
