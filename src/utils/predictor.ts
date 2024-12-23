import { BaseHouseData } from '../types/HouseData';
import { MLModel } from './mlModel';
import { getInitialTrainingData } from './fileParser';
import { getPredictionsForTraining } from '../db/training';
import { storePrediction } from '../db/database';
import { getReductionFactor } from './reductionFactors';
import { saveCalculation } from '../services/supabase';
import { roofTypes } from '../constants/buildingData';

export class HeatLossPredictor {
  private mlModel: MLModel;
  private trainingData: BaseHouseData[];
  private readonly CONFIDENCE_THRESHOLD = 0.95;
  
  constructor() {
    this.mlModel = new MLModel();
    this.trainingData = getInitialTrainingData();
    this.initializeTrainingData();
  }
  
  private async initializeTrainingData() {
    try {
      const storedPredictions = await getPredictionsForTraining();
      this.trainingData = [...this.trainingData, ...storedPredictions];
      this.train(this.trainingData);
    } catch (error) {
      console.error('Error loading stored predictions:', error);
      this.train(this.trainingData);
    }
  }
  
  train(data: BaseHouseData[]): void {
    const adjustedData = data.map(house => ({
      ...house,
      heatLoss: house.heatLoss * getReductionFactor(house.age)
    }));
    this.trainingData = [...this.trainingData, ...adjustedData];
    this.mlModel.train(this.trainingData);
  }
  
  predict(input: Partial<BaseHouseData>): number {
    try {
      // Ensure required fields are present
      if (!input.size || !input.age || !input.windowType || !input.wallType || !input.floorType || !input.roofType) {
        throw new Error('Missing required input fields');
      }

      const rawPrediction = this.mlModel.predictHeatLoss(input);
      const reductionFactor = getReductionFactor(input.age);
      
      const roofType = input.roofType;
      const roofUValue = roofTypes[roofType as keyof typeof roofTypes]?.uValue || 0.34;
      const roofFactor = 1 + ((roofUValue - 0.11) / 2.19);
      
      const adjustedPrediction = rawPrediction * reductionFactor * roofFactor;
      const confidenceScore = this.calculateConfidenceScore(input);
      
      // Save to Supabase
      saveCalculation({
        ...input as BaseHouseData,
        heatLoss: adjustedPrediction
      }).catch(console.error);

      // Save to IndexedDB
      storePrediction(input, adjustedPrediction, undefined, confidenceScore).catch(console.error);
      
      return adjustedPrediction;
    } catch (error) {
      console.error('Error making prediction:', error);
      throw error;
    }
  }

  private calculateConfidenceScore(input: Partial<BaseHouseData>): number {
    const similarCases = this.trainingData.filter(data => 
      data.propertyType === input.propertyType &&
      Math.abs(data.size - (input.size || 0)) < 20 &&
      data.age === input.age
    );

    return Math.min(1, similarCases.length / 10);
  }

  async validatePrediction(input: Partial<BaseHouseData>, prediction: number, krakenValue: number): Promise<void> {
    const percentageDiff = Math.abs((krakenValue - prediction) / ((krakenValue + prediction) / 2)) * 100;
    const accuracy = 100 - percentageDiff;
    const confidenceScore = this.calculateConfidenceScore(input);
    
    // Save to Supabase with kraken value
    await saveCalculation({
      ...input as BaseHouseData,
      heatLoss: prediction,
      krakenValue
    });

    // Save to IndexedDB
    await storePrediction(input, prediction, krakenValue, confidenceScore);

    if (accuracy < 90 && confidenceScore >= this.CONFIDENCE_THRESHOLD) {
      this.train([{ ...input as BaseHouseData, heatLoss: krakenValue }]);
    }
  }
}