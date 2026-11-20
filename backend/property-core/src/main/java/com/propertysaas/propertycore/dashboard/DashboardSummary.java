package com.propertysaas.propertycore.dashboard;

public record DashboardSummary(
        long totalProperties,
        long activeProperties,
        long archivedProperties,
        long totalUnits,
        long availableUnits,
        long unavailableUnits,
        long occupiedUnits
) {}
