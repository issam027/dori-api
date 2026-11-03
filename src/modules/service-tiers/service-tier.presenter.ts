import { QueueTierResponseDto } from './dto/tier-response.dto';
import { QueueTierRow } from './service-tiers.repository';

/** Shared representation for listing and association mutations. */
export function presentQueueTier(row: QueueTierRow): QueueTierResponseDto {
  return {
    queueId: row.queue_id,
    tierId: row.tier_id,
    price: Number(row.price),
    currency: row.currency,
    currencyOverride: row.currency_override ?? null,
    currencyOrigin: row.currency_origin,
    isActive: row.is_active,
    isDefault: row.is_default,
    displayOrder: row.display_order,
    tier: {
      tierId: row.tier_id,
      tierCode: row.tier_code,
      tierName: row.tier_name,
      description: row.tier_description ?? row.description,
      isSystem: row.is_system,
      isActive: row.tier_is_active ?? row.is_active,
    },
  };
}
