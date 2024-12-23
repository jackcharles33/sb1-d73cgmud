import { createClient } from '@supabase/supabase-js';
import { BaseHouseData } from '../types/HouseData';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function saveCalculation(data: BaseHouseData & { krakenValue?: number }): Promise<void> {
  try {
    const { error } = await supabase
      .from('calculations')
      .insert({
        size: data.size,
        age: data.age,
        property_type: data.propertyType,
        window_type: data.windowType,
        wall_type: data.wallType,
        floor_type: data.floorType,
        roof_type: data.roofType,
        heat_loss: data.heatLoss,
        kraken_value: data.krakenValue
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error saving calculation:', error);
  }
}