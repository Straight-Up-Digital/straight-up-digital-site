import { hostingPlans, websiteBuildPackages, websiteOffer } from "./pricing.ts";

/** Owner-approved discount on bundle build plus first annual hosting term. */
export const bundleDiscountPercent = 5;
const roundToNearestTen = (amount: number): number => Math.round(amount / 10) * 10;
const discountedPrice = (listedTotalZar: number): number =>
  roundToNearestTen(listedTotalZar * (1 - bundleDiscountPercent / 100));

export const websiteHostingBundles = hostingPlans.map((hostingPlan) => {
  const listedTotalZar = websiteOffer.buildOnceOffZar + hostingPlan.priceAnnualZar;
  const priceZar = discountedPrice(listedTotalZar);
  return {
    slug: hostingPlan.slug,
    name: `${hostingPlan.name} Launch Bundle`,
    hostingPlan,
    buildPriceZar: websiteOffer.buildOnceOffZar,
    monthly: {
      buildPriceZar: websiteOffer.buildOnceOffZar,
      hostingMonthlyZar: hostingPlan.priceMonthlyZar,
    },
    annual: {
      listedTotalZar,
      priceZar,
      savingZar: listedTotalZar - priceZar,
      hostingAnnualZar: hostingPlan.priceAnnualZar,
    },
  };
});

/** Specialist builds paired with their recommended annual hosting tier. */
export const websiteBuildHostingBundles = websiteBuildPackages
  .filter((websitePackage) => websitePackage.slug !== "one-page-starter")
  .map((websitePackage) => {
    const hostingPlan = hostingPlans.find(
      (plan) => plan.slug === websitePackage.recommendedHostingPlanSlug,
    );
    if (!hostingPlan) throw new Error(`Missing hosting plan for ${websitePackage.slug}`);
    const listedTotalZar = websitePackage.priceZar + hostingPlan.priceAnnualZar;
    const priceZar = discountedPrice(listedTotalZar);

    return {
      slug: websitePackage.slug,
      name: `${websitePackage.title} + ${hostingPlan.name}`,
      websitePackage,
      hostingPlan,
      monthly: {
        buildPriceZar: websitePackage.priceZar,
        hostingMonthlyZar: hostingPlan.priceMonthlyZar,
      },
      annual: {
        listedTotalZar,
        priceZar,
        savingZar: listedTotalZar - priceZar,
        hostingAnnualZar: hostingPlan.priceAnnualZar,
      },
    };
  });
