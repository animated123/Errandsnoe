import { ErrandCategory } from '../types';

export const calculatePrice = (category: ErrandCategory, distance: number, taskDetails: any) => {
  let basePrice = 0;
  
  switch (category) {
    case ErrandCategory.MAMA_FUA:
      // Base price per basket
      const baskets = taskDetails.laundryBaskets || 1;
      basePrice = baskets * 250;
      break;
    case ErrandCategory.HOUSE_HUNTING:
      // Flat fee for house hunting search
      basePrice = 1500;
      break;
    case ErrandCategory.GENERAL:
    default:
      basePrice = 300;
      break;
  }

  // Distance surcharge: Ksh 50 per km after 2km
  const distanceSurcharge = Math.max(0, distance - 2) * 50;
  
  return Math.round(basePrice + distanceSurcharge);
};
