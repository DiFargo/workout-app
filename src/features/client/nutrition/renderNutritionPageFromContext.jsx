export function renderNutritionPageFromContext(ctx) {
const {
  NUTRITION_ICON_PRESETS,
  NutritionPageView,
  activeNutritionSearchResultLimit,
  addNutritionFoodFromPicker,
  addNutritionProductManuallyFromPhoto,
  addSelectedDishIngredientFromFood,
  aiNutritionProfile,
  aiNutritionProfileDraft,
  aiNutritionSavedPlan,
  barcodeScannerOpen,
  buildNutritionPageModel,
  canDeleteSelectedNutritionFood,
  cancelNutritionEditPage,
  closeSelectedNutritionFood,
  confirmNutritionEditPage,
  confirmNutritionFoodFromPicker,
  createCustomNutritionDish,
  createCustomNutritionFood,
  deleteSelectedNutritionFood,
  deletingNutritionFoodId,
  dishIngredientExternalFoods,
  dishIngredientFallbackSuggestions,
  dishIngredientLoading,
  dishIngredientPickerOpen,
  dishIngredientSearch,
  editingNutritionItemId,
  expandedNutritionMeals,
  fatSecretError,
  fatSecretLoading,
  getFoodIcon,
  getFoodPortionAmount,
  getFoodScale,
  getNutritionSmartUnitId,
  getNutritionSmartUnits,
  handleNutritionFoodSwipeCancel,
  handleNutritionFoodSwipeEnd,
  handleNutritionFoodSwipeMove,
  handleNutritionFoodSwipeStart,
  handleNutritionPhotoAiSearch,
  history,
  isAiNutritionPlanExpanded,
  isNutritionToday,
  nutrition,
  nutritionAmount,
  nutritionAmountError,
  nutritionAmountMode,
  nutritionCalendarDays,
  nutritionCalendarMonthLabel,
  nutritionCalendarOpen,
  nutritionCreateChoiceOpen,
  nutritionCurrentStreak,
  nutritionDateKey,
  nutritionDeleteConfirmOpen,
  nutritionEditNote,
  nutritionEditPageOpen,
  nutritionFallbackSuggestions,
  nutritionFoodSwipeMoved,
  nutritionFoodSwipeOffsets,
  nutritionMeal,
  nutritionMealMenuOpen,
  nutritionMeals,
  nutritionPhotoAiCandidates,
  nutritionPhotoAiConfidence,
  nutritionPhotoAiResult,
  nutritionPhotoAnalyzing,
  nutritionPhotoInputRef,
  nutritionPhotoNotFoundOpen,
  nutritionPhotoPreview,
  nutritionPickerOpen,
  nutritionProductErrors,
  nutritionProductUnitMenuOpen,
  nutritionSearch,
  nutritionSearchResultKey,
  nutritionSearchResults,
  nutritionSearchTab,
  nutritionToday,
  nutritionTotals,
  nutritionUndoDelete,
  nutritionWeekDates,
  nutritionZoukExpanded,
  openDishIngredientPicker,
  openNutritionCalendar,
  openNutritionEditPage,
  openNutritionFoodEditor,
  openNutritionPicker,
  pendingDishIngredient,
  pendingDishIngredientGrams,
  recentNutritionFoods,
  removeSelectedDishIngredient,
  renderTrainerMainBottomBar,
  resetNutritionPhotoAiSearch,
  resetNutritionPhotoAiState,
  restoreNutritionFood,
  retryNutritionPhotoFromNotFound,
  roundMacro,
  saveNutritionPreferredUnit,
  saveRecentNutritionFood,
  selectNutritionDate,
  selectNutritionPhotoAiCandidate,
  selectedNutritionFood,
  setBarcodeScannerOpen,
  setDishIngredientPickerOpen,
  setDishIngredientSearch,
  setEditingNutritionItemId,
  setExpandedNutritionMeals,
  setFatSecretError,
  setIsAiNutritionPlanExpanded,
  setNutritionAmount,
  setNutritionAmountError,
  setNutritionAmountMode,
  setNutritionCalendarOpen,
  setNutritionCreateChoiceOpen,
  setNutritionDeleteConfirmOpen,
  setNutritionEditDetailsOpen,
  setNutritionEditNote,
  setNutritionEditPageOpen,
  setNutritionFallbackSuggestions,
  setNutritionMeal,
  setNutritionMealMenuOpen,
  setNutritionPickerOpen,
  setNutritionProductUnitMenuOpen,
  setNutritionSearch,
  setNutritionSearchResultLimit,
  setNutritionSearchTab,
  setNutritionZoukExpanded,
  setPendingDishIngredient,
  setPendingDishIngredientGrams,
  setSelectedNutritionFood,
  setShowRecentNutritionFoods,
  shiftNutritionCalendarMonth,
  showRecentNutritionFoods,
  todayNutritionKey,
  updateSelectedDishTotalWeight,
  updateSelectedNutritionFoodField,
  updateSelectedNutritionPortionUnit,
  validateNutritionAmount,
  visibleNutritionSearchResults
} = ctx;


  const {
    effectiveNutritionGoals,
    caloriePercent,
    isCaloriesOverGoal,
    caloriesLeft,
    caloriesConsumed,
    proteinPercent,
    fatPercent,
    carbsPercent,
    weekDates,
    nutritionStreakText,
    nutritionDateTitle,
    mealStats,
    nutritionZoukFoodsCount,
    activeNutritionMeal,
    activeNutritionMealFoods,
    activeNutritionMealStats,
    aiNutritionDay,
    aiNutritionGoalText,
    aiNutritionCurrentWeek,
    isNutritionTrainingDayToday,
    aiNutritionTodayPlanMacros,
    aiNutritionScoreStyle,
    nutritionSummaryCollapsedText,
    nutritionOrbitItems
  } = buildNutritionPageModel({
    aiNutritionSavedPlan,
    aiNutritionProfile,
    aiNutritionProfileDraft,
    nutrition,
    history,
    nutritionTotals,
    nutritionDateKey,
    isNutritionToday,
    nutritionToday,
    nutritionMeals,
    expandedNutritionMeals,
    nutritionWeekDates,
    nutritionCurrentStreak
  });

  return (
    <NutritionPageView
      pickerOpen={nutritionPickerOpen}
      calendarOpen={nutritionCalendarOpen}
      activeMeal={activeNutritionMeal}
      renderBottomBar={renderTrainerMainBottomBar}
      headerProps={{
        nutritionDateTitle,
        weekDates,
        nutrition,
        nutritionDateKey,
        nutritionStreakText,
        onOpenSearch: () => openNutritionPicker(nutritionMeal),
        onOpenCalendar: openNutritionCalendar,
        onSelectDate: selectNutritionDate
      }}
      calendarProps={{
        monthLabel: nutritionCalendarMonthLabel,
        days: nutritionCalendarDays,
        onClose: () => setNutritionCalendarOpen(false),
        onShiftMonth: shiftNutritionCalendarMonth,
        onSelectDate: selectNutritionDate,
        onSelectToday: () => selectNutritionDate(todayNutritionKey())
      }}
      summaryProps={{
        isCaloriesOverGoal,
        onExpand: () => setIsAiNutritionPlanExpanded(true)
      }}
      orbitProps={{
        items: nutritionOrbitItems,
        onAdd: () => openNutritionPicker()
      }}
      diaryProps={{
        nutritionZoukExpanded,
        nutritionZoukFoodsCount,
        nutritionMeals,
        nutritionToday,
        mealStats,
        expandedNutritionMeals,
        deletingFoodId: deletingNutritionFoodId,
        swipeOffsets: nutritionFoodSwipeOffsets,
        swipeMovedRef: nutritionFoodSwipeMoved,
        getFoodIcon,
        roundMacro,
        onOpenZouk: () => setNutritionZoukExpanded(true),
        onCloseZouk: () => setNutritionZoukExpanded(false),
        onAddMealFood: (mealId) => {
          setNutritionZoukExpanded(false);
          openNutritionPicker(mealId);
        },
        onEditFood: (item) => {
          setNutritionZoukExpanded(false);
          openNutritionFoodEditor(item);
          setNutritionSearchTab("food");
        },
        onOpenMealFoods: (mealId) => setExpandedNutritionMeals({ [mealId]: true }),
        onSwipeStart: handleNutritionFoodSwipeStart,
        onSwipeMove: handleNutritionFoodSwipeMove,
        onSwipeEnd: handleNutritionFoodSwipeEnd,
        onSwipeCancel: handleNutritionFoodSwipeCancel
      }}
      mealModalProps={{
        activeMeal: activeNutritionMeal,
        foods: activeNutritionMealFoods,
        stats: activeNutritionMealStats,
        deletingFoodId: deletingNutritionFoodId,
        swipeOffsets: nutritionFoodSwipeOffsets,
        swipeMovedRef: nutritionFoodSwipeMoved,
        getFoodIcon,
        onClose: () => setExpandedNutritionMeals({}),
        onAddFood: (mealId) => {
          setExpandedNutritionMeals({});
          openNutritionPicker(mealId);
        },
        onEditFood: (item) => {
          openNutritionFoodEditor(item);
          setNutritionSearchTab("food");
        },
        onSwipeStart: handleNutritionFoodSwipeStart,
        onSwipeMove: handleNutritionFoodSwipeMove,
        onSwipeEnd: handleNutritionFoodSwipeEnd,
        onSwipeCancel: handleNutritionFoodSwipeCancel
      }}
      planDetailsProps={{
        isExpanded: isAiNutritionPlanExpanded,
        isCaloriesOverGoal,
        goalText: aiNutritionGoalText,
        isTrainingDay: isNutritionTrainingDayToday,
        todayPlanMacros: aiNutritionTodayPlanMacros,
        summaryText: nutritionSummaryCollapsedText,
        caloriePercent,
        caloriesLeft,
        caloriesConsumed,
        effectiveGoals: effectiveNutritionGoals,
        scoreStyle: aiNutritionScoreStyle,
        nutritionDay: aiNutritionDay,
        proteinPercent,
        fatPercent,
        carbsPercent,
        nutritionTotals,
        roundMacro,
        currentWeek: aiNutritionCurrentWeek,
        onClose: () => setIsAiNutritionPlanExpanded(false)
      }}
      overlayData={{
        selectedFood: selectedNutritionFood,
        barcodeOpen: barcodeScannerOpen,
        header: {
          selectedFood: selectedNutritionFood,
          searchTab: nutritionSearchTab,
          createChoiceOpen: nutritionCreateChoiceOpen,
          mealMenuOpen: nutritionMealMenuOpen,
          meals: nutritionMeals,
          mealId: nutritionMeal,
          onToggleMealMenu: () => setNutritionMealMenuOpen((open) => !open),
          onSelectMeal: (mealId) => {
            setNutritionMeal(mealId);
            setNutritionMealMenuOpen(false);
          },
          onCollapseMealMenu: () => setNutritionMealMenuOpen(false),
          onClose: () => {
            if (nutritionCreateChoiceOpen) {
              setNutritionCreateChoiceOpen(false);
              setNutritionMealMenuOpen(false);
              return;
            }
            setNutritionMealMenuOpen(false);
            setSelectedNutritionFood(null);
            setEditingNutritionItemId(null);
            setNutritionPickerOpen(false);
          }
        },
        product: {
          selectedFood: selectedNutritionFood,
          isEditing: Boolean(editingNutritionItemId),
          editPageOpen: nutritionEditPageOpen,
          meals: nutritionMeals,
          mealId: nutritionMeal,
          mealMenuOpen: nutritionMealMenuOpen,
          amount: nutritionAmount,
          amountMode: nutritionAmountMode,
          amountError: nutritionAmountError,
          unitMenuOpen: nutritionProductUnitMenuOpen,
          editNote: nutritionEditNote,
          iconPresets: NUTRITION_ICON_PRESETS,
          productErrors: nutritionProductErrors,
          dishIngredientPickerOpen,
          dishIngredientSearch,
          dishIngredientLoading,
          nutrition,
          recentFoods: recentNutritionFoods,
          dishIngredientExternalFoods,
          dishIngredientFallbackSuggestions,
          pendingDishIngredient,
          pendingDishIngredientGrams,
          deleteConfirmOpen: nutritionDeleteConfirmOpen,
          canDelete: canDeleteSelectedNutritionFood(),
          getFoodIcon,
          getFoodScale,
          getFoodPortionAmount,
          getSmartUnits: getNutritionSmartUnits,
          getSmartUnitId: getNutritionSmartUnitId,
          roundMacro,
          validateAmount: validateNutritionAmount,
          onToggleMealMenu: () => setNutritionMealMenuOpen((open) => !open),
          onSelectMeal: (mealId) => {
            setNutritionMeal(mealId);
            setNutritionMealMenuOpen(false);
          },
          onUseGrams: () => {
            saveNutritionPreferredUnit(selectedNutritionFood, "grams");
            setNutritionProductUnitMenuOpen(false);
            setNutritionAmountMode("grams");
            setNutritionAmount("100");
          },
          onToggleUnitMenu: () => setNutritionProductUnitMenuOpen((open) => !open),
          onSelectUnit: (unit) => {
            setNutritionAmountMode(unit.mode || "portion");
            setNutritionAmount(String(unit.amount || 100));
            saveNutritionPreferredUnit(selectedNutritionFood, unit.id);
            setNutritionProductUnitMenuOpen(false);

            if (unit.mode === "portion") {
              updateSelectedNutritionFoodField("portion", unit.portion || unit.label || "1 порция");
              updateSelectedNutritionFoodField("portionAmount", unit.portionAmount || unit.amount || 100);
            }
          },
          onAmountChange: (value) => {
            setNutritionAmount(value);
            setNutritionAmountError("");
          },
          onOpenEditPage: openNutritionEditPage,
          onUpdateField: updateSelectedNutritionFoodField,
          onUpdateDishTotalWeight: updateSelectedDishTotalWeight,
          onUpdatePortionUnit: updateSelectedNutritionPortionUnit,
          onOpenIngredientPicker: openDishIngredientPicker,
          onRemoveIngredient: removeSelectedDishIngredient,
          onCloseIngredientPicker: () => setDishIngredientPickerOpen(false),
          onDishIngredientSearchChange: setDishIngredientSearch,
          onPendingDishIngredientChange: setPendingDishIngredient,
          onPendingDishIngredientGramsChange: setPendingDishIngredientGrams,
          onAddSelectedDishIngredientFromFood: addSelectedDishIngredientFromFood,
          onEditNoteChange: setNutritionEditNote,
          onCancelEdit: cancelNutritionEditPage,
          onConfirmEdit: confirmNutritionEditPage,
          onBack: closeSelectedNutritionFood,
          onDelete: () => deleteSelectedNutritionFood(),
          onCancelDelete: () => setNutritionDeleteConfirmOpen(false),
          onConfirmDelete: () => deleteSelectedNutritionFood(true),
          onAdd: confirmNutritionFoodFromPicker
        },
        search: {
          photoInputRef: nutritionPhotoInputRef,
          search: nutritionSearch,
          searchTab: nutritionSearchTab,
          createChoiceOpen: nutritionCreateChoiceOpen,
          showRecentFoods: showRecentNutritionFoods,
          recentFoods: recentNutritionFoods,
          photoAnalyzing: nutritionPhotoAnalyzing,
          fatSecretError,
          fatSecretLoading,
          fallbackSuggestions: nutritionFallbackSuggestions,
          searchResults: nutritionSearchResults,
          visibleResults: visibleNutritionSearchResults,
          nutrition,
          photoNotFoundOpen: nutritionPhotoNotFoundOpen,
          photoPreview: nutritionPhotoPreview,
          photoConfidence: nutritionPhotoAiConfidence,
          photoResult: nutritionPhotoAiResult,
          selectedFood: selectedNutritionFood,
          photoCandidates: nutritionPhotoAiCandidates,
          onSearchChange: (value) => {
            setNutritionSearch(value);
            setNutritionSearchTab("food");
            setShowRecentNutritionFoods(false);
          },
          onSearchReset: () => {
            setNutritionSearch("");
            setNutritionFallbackSuggestions([]);
          },
          onHistorySelect: (foodName) => {
            setNutritionSearch(foodName);
            setNutritionSearchTab("food");
            setShowRecentNutritionFoods(false);
          },
          onRecentFoodSelect: (food) => {
            setNutritionSearch(food.name.split(" — ")[0]);
            setNutritionSearchTab("food");
            setShowRecentNutritionFoods(false);
            setNutritionCreateChoiceOpen(false);
            setNutritionMealMenuOpen(false);
            addNutritionFoodFromPicker(food);
          },
          onSuggestionSelect: (suggestion) => {
            if (suggestion.includes("фото")) {
              nutritionPhotoInputRef.current?.click();
            } else {
              setNutritionCreateChoiceOpen(true);
            }
          },
          onMyFoodSelect: (normalizedFood) => {
            const myFoodId = normalizedFood.id || normalizedFood.foodId;
            const nextAmount = normalizedFood.amountMode === "portion"
              ? (normalizedFood.portionAmount || 100)
              : (normalizedFood.lastAmount || normalizedFood.portionAmount || 100);
            saveRecentNutritionFood(normalizedFood);
            setSelectedNutritionFood({
              ...normalizedFood,
              id: myFoodId,
              foodId: myFoodId,
              source: "Моя база",
              icon: normalizedFood.icon || getFoodIcon(normalizedFood)
            });
            setEditingNutritionItemId(`my:${myFoodId}`);
            setNutritionAmount(String(nextAmount));
            setNutritionAmountMode("grams");
            setNutritionEditNote("");
            setNutritionEditDetailsOpen(false);
            setNutritionEditPageOpen(false);
            setNutritionMealMenuOpen(false);
            setShowRecentNutritionFoods(false);
          },
          onFoodSelect: addNutritionFoodFromPicker,
          onShowMore: () => setNutritionSearchResultLimit({
            key: nutritionSearchResultKey,
            limit: activeNutritionSearchResultLimit + 8
          }),
          onBack: () => {
            setNutritionMealMenuOpen(false);
            setSelectedNutritionFood(null);
            setEditingNutritionItemId(null);
            setNutritionEditDetailsOpen(false);
            setNutritionEditPageOpen(false);
            setBarcodeScannerOpen(false);
            setNutritionCreateChoiceOpen(false);
            setNutritionPickerOpen(false);
          },
          onSearchTabSelect: () => {
            setFatSecretError("");
            setBarcodeScannerOpen(false);
            setNutritionCreateChoiceOpen(false);
            setNutritionSearchTab("food");
            setShowRecentNutritionFoods(false);
          },
          onPhotoSelect: () => {
            setBarcodeScannerOpen(false);
            setNutritionCreateChoiceOpen(false);
            nutritionPhotoInputRef.current?.click();
          },
          onCreateSelect: () => {
            setBarcodeScannerOpen(false);
            setNutritionCreateChoiceOpen(true);
          },
          onMyProductsSelect: () => {
            setBarcodeScannerOpen(false);
            setNutritionCreateChoiceOpen(false);
            setNutritionSearch("");
            setNutritionSearchTab("my");
            setShowRecentNutritionFoods(false);
          },
          onCreateFood: createCustomNutritionFood,
          onCreateDish: createCustomNutritionDish,
          onPhotoInputChange: handleNutritionPhotoAiSearch,
          onPhotoNotFoundClose: resetNutritionPhotoAiState,
          onPhotoRetry: retryNutritionPhotoFromNotFound,
          onPhotoAddManually: addNutritionProductManuallyFromPhoto,
          onPhotoCandidateSelect: selectNutritionPhotoAiCandidate,
          onPhotoReset: resetNutritionPhotoAiSearch
        }
      }}
      undoDeleteItem={nutritionUndoDelete}
      onUndoDelete={restoreNutritionFood}
    />
  );
}
