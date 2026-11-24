import { hostingPlans, websiteOffer } from "./pricing";

/** A small-discount assumption because the owner requested a slight discount but gave no percentage. */
export const bundleDiscountPercent = 5;

const roundToNearestTen = (amount: number): number => Math.round(amount / 10) * 10;
const discountedPrice = (listedTotalZar: number): number =>
  roundToNearestTen(listedTotalZar * (1 - bundleDiscountPercent / 100));

export const websiteHostingBundles = hostingPlans.map((hostingPlan) => {
  const monthlyListedTotalZar = websiteOffer.buildOnceOffZar + hostingPlan.priceMonthlyZar;
  const annualListedTotalZar = websiteOffer.buildOnceOffZar + hostingPlan.priceAnnualZar;
  const monthlyFirstBillZar = discountedPrice(monthlyListedTotalZar);
  const annualFirstYearZar = discountedPrice(annualListedTotalZar);

  return {
    slug: hostingPlan.slug,
    name: `${hostingPlan.name} Launch Bundle`,
    hostingPlan,
    monthly: {
      listedTotalZar: monthlyListedTotalZar,
      priceZar: monthlyFirstBillZar,
      savingZar: monthlyListedTotalZar - monthlyFirstBillZar,
      ongoingHostingMonthlyZar: hostingPlan.priceMonthlyZar,
    },
    annual: {
      listedTotalZar: annualListedTotalZar,
      priceZar: annualFirstYearZar,
      savingZar: annualListedTotalZar - annualFirstYearZar,
      hostingAnnualZar: hostingPlan.priceAnnualZar,
    },
  };
});
