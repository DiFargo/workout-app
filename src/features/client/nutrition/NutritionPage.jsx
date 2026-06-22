export default function NutritionPage({
  children,
  appVersion,
  showVersionBadge = true
}) {
  return (
    <div className="fatSecretPage nutritionFixedHeaderV3 clientCorePage clientCorePageNutrition">
      {showVersionBadge && appVersion && (
        <div className="appVersionBadge clientPageVersionBadge">{appVersion}</div>
      )}
      {children}
    </div>
  );
}
