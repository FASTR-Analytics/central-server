export type DisaggregationOption =
  | "indicator_common_id" | "admin_area_2" | "admin_area_3" | "admin_area_4"
  | "year" | "month" | "quarter_id" | "period_id"
  | "denominator" | "denominator_best_or_survey" | "source_indicator"
  | "target_population" | "ratio_type" | "facility_name" | "facility_type"
  | "facility_ownership" | "facility_custom_1" | "facility_custom_2"
  | "facility_custom_3" | "facility_custom_4" | "facility_custom_5"
  | "hfa_indicator" | "hfa_category" | "time_point";

export type PeriodOption = "period_id" | "year" | "quarter_id";

export type PeriodBounds = {
  periodOption: PeriodOption;
  min: number;
  max: number;
};

export type PeriodFilter =
  | { filterType: "all" }
  | { filterType: "last_n_years"; n: number }
  | { filterType: "last_n_periods"; n: number }
  | { filterType: "custom"; minBound: number; maxBound: number }
  | { filterType: "from_month"; fromBound: number };

export type GenericLongFormFetchConfig = {
  values: {
    prop: string;
    func: "SUM" | "AVG" | "COUNT" | "MIN" | "MAX" | "identity";
  }[];
  groupBys: (DisaggregationOption | PeriodOption)[];
  filters: { disOpt: DisaggregationOption; values: (string | number)[] }[];
  periodFilter: PeriodFilter | undefined;
  periodFilterExactBounds?: PeriodBounds;
  postAggregationExpression: string | undefined;
  includeNationalForAdminArea2?: boolean;
  includeNationalPosition?: "bottom" | "top";
};

export type IndicatorMetadata = {
  id: string;
  label: string;
  format_as?: string;
  decimal_places?: number;
  threshold_direction?: string;
  threshold_green?: number | null;
  threshold_yellow?: number | null;
  group_label?: string | null;
  sort_order?: number | null;
};

export type ItemsHolderPresentationObject = {
  projectId: string;
  resultsObjectId: string;
  fetchConfig: GenericLongFormFetchConfig;
  moduleLastRun: string;
  dateRange: PeriodBounds | undefined;
} & (
  | { status: "ok"; items: Record<string, string>[]; indicatorMetadata: IndicatorMetadata[] }
  | { status: "too_many_items" }
  | { status: "no_data_available" }
);

export type DisaggregationPossibleValuesStatus =
  | { status: "ok"; values: string[] }
  | { status: "too_many_values" }
  | { status: "no_values_available" }
  | { status: "error"; message: string };

export type ResultsValueInfoForPresentationObject = {
  resultsObjectId: string;
  metricId: string;
  projectId: string;
  moduleLastRun: string;
  periodBounds?: PeriodBounds;
  disaggregationPossibleValues: {
    [key in DisaggregationOption]?: DisaggregationPossibleValuesStatus;
  };
};

export function periodFilterHasBounds(
  filter: PeriodFilter
): filter is { filterType: "custom"; minBound: number; maxBound: number } | { filterType: "from_month"; fromBound: number } {
  return filter.filterType === "custom" || filter.filterType === "from_month";
}

export function getPeriodFilterExactBounds(
  periodFilter: PeriodFilter | undefined,
  rawDateRange: PeriodBounds | undefined,
): PeriodBounds | undefined {
  if (!periodFilter || !rawDateRange) return undefined;
  if (periodFilter.filterType === "all") return undefined;

  if (periodFilter.filterType === "custom") {
    return { ...rawDateRange, min: periodFilter.minBound, max: periodFilter.maxBound };
  }
  if (periodFilter.filterType === "from_month") {
    return { ...rawDateRange, min: periodFilter.fromBound };
  }
  if (periodFilter.filterType === "last_n_years") {
    return { ...rawDateRange, min: rawDateRange.max - periodFilter.n + 1 };
  }
  if (periodFilter.filterType === "last_n_periods") {
    return { ...rawDateRange, min: rawDateRange.max - periodFilter.n + 1 };
  }
  return undefined;
}
