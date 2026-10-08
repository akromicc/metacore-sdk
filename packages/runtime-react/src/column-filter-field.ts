import type { ColumnFilterConfig } from './dynamic-columns-shim'

interface FilterFieldColumn {
    key?: string
    filterField?: string
    /** snake_case spelling emitted by some kernels. */
    filter_field?: string
}

/**
 * Honors `ColumnDefinition.filterField`: a display column (e.g.
 * `institution_type.name`) filters by its persisted field (`institution_type_id`).
 * The header filter keeps living on the display column, but its `filterKey` —
 * and therefore the `f_*` param sent to the backend — becomes the filterField.
 * When the filterField has its own option source (static options, searchEndpoint
 * or loader) the column adopts it, so options are the FK values. A column whose filterField has no config of its own keeps its display options
 * (which may be names, not FK ids) while its selection is read from the
 * filterField key. Columns without
 * `filterField` (or equal to their key) are returned untouched.
 */
export function applyColumnFilterFields(
    columns: readonly FilterFieldColumn[] | undefined,
    configs: Map<string, ColumnFilterConfig>,
    dynamicFilters: Record<string, string[]> = {},
): Map<string, ColumnFilterConfig> {
    if (!columns?.length) return configs

    let resolved: Map<string, ColumnFilterConfig> | null = null
    for (const column of columns) {
        if (!column.key) continue
        const filterField = column.filterField || column.filter_field
        if (!filterField || filterField === column.key) continue

        const displayConfig = configs.get(column.key)
        if (!displayConfig) continue

        const fieldConfig = configs.get(filterField)
        const fieldHasOwnOptions = Boolean(
            fieldConfig &&
                (fieldConfig.options.length > 0 ||
                    fieldConfig.searchEndpoint ||
                    fieldConfig.loadOptions),
        )

        resolved ??= new Map(configs)
        resolved.set(column.key, {
            ...displayConfig,
            ...(fieldConfig && fieldHasOwnOptions
                ? {
                      filterType: fieldConfig.filterType,
                      options: fieldConfig.options,
                      loading: fieldConfig.loading,
                      searchEndpoint: fieldConfig.searchEndpoint,
                      loadOptions: fieldConfig.loadOptions,
                  }
                : {}),
            filterKey: filterField,
            // Sin config propia del campo, la selección vive bajo la key del filterField.
            selectedValues: fieldConfig
                ? (fieldConfig.selectedValues ?? displayConfig.selectedValues)
                : (dynamicFilters[filterField] ?? []),
            onFilterChange: fieldConfig?.onFilterChange ?? displayConfig.onFilterChange,
        })
    }
    return resolved ?? configs
}
