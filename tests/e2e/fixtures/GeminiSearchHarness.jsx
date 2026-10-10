import { useState } from "react";
import { createRoot } from "react-dom/client";
import FoodSearchPage from "../../../src/features/client/nutrition/FoodSearchPage";
import { useNutritionSearchEffects } from "../../../src/features/client/nutrition/useNutritionSearchEffects";
import { buildNutritionSearchResults } from "../../../src/utils/nutritionSearchResults";
import "../../../src/styles/index.css";

const noop = () => {};
const nutrition = { myFoods: { saved: { id: "saved", name: "Nutella из моей базы", calories: 500 } }, goals: {} };
function Harness() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("food");
  const [foods, setFoods] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const { geminiSearchSuggestions, retryNutritionSearch } = useNutritionSearchEffects({
    dishIngredientSearch: "", dishIngredientPickerOpen: false, nutritionPickerOpen: true,
    nutritionSearch: search, nutritionSearchTab: tab,
    endPerformanceCheck: noop, startPerformanceCheck: noop, showAppError: noop,
    setDishIngredientExternalFoods: noop, setDishIngredientFallbackSuggestions: noop, setDishIngredientLoading: noop,
    setFatSecretError: setError, setFatSecretFoods: setFoods, setFatSecretLoading: setLoading, setNutritionFallbackSuggestions: noop
  });
  const results = buildNutritionSearchResults({nutritionSearch:search,nutritionSearchTab:tab,nutrition,fatSecretFoods:foods});
  return <main style={{maxWidth:440,margin:"auto",padding:12}}>
    {selected && <output data-testid="selected-food">{selected.name} · {selected.calories} ккал</output>}
    <FoodSearchPage search={search} searchTab={tab} fatSecretLoading={loading} fatSecretError={error}
      searchResults={results} visibleResults={results} nutrition={nutrition} fallbackSuggestions={[]} recentFoods={[]}
      onSearchChange={setSearch} onSearchReset={()=>setSearch("")} onSearchRetry={retryNutritionSearch}
      geminiSearchSuggestions={geminiSearchSuggestions} onFoodSelect={setSelected} onMyFoodSelect={setSelected}
      onMyProductsSelect={()=>setTab("my")} onSearchTabSelect={()=>setTab("food")}
      onBack={noop} onCreateSelect={noop} onPhotoInputChange={noop} />
  </main>;
}
createRoot(document.getElementById("root")).render(<Harness/>);
