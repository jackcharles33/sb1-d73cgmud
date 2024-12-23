import { writeFile, appendFile, existsSync } from 'fs';
import { join } from 'path';
import { BaseHouseData } from '../../types/HouseData';

const CSV_FILE = join(process.cwd(), 'data', 'calculations.csv');
const HEADERS = ['timestamp', 'size', 'age', 'propertyType', 'windowType', 'wallType', 'floorType', 'roofType', 'heatLoss'];

export async function saveCalculation(data: BaseHouseData): Promise<void> {
  const timestamp = new Date().toISOString();
  const row = [
    timestamp,
    data.size,
    data.age,
    data.propertyType || '',
    data.windowType,
    data.wallType,
    data.floorType,
    data.roofType,
    data.heatLoss
  ].join(',');

  if (!existsSync(CSV_FILE)) {
    await writeFile(CSV_FILE, HEADERS.join(',') + '\n', 'utf8');
  }
  
  await appendFile(CSV_FILE, row + '\n', 'utf8');
}