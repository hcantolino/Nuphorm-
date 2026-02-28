/**
 * Multimodal Image Analysis Module
 * Analyzes gel blots, chromatograms, and other pharma images
 * Provides basic band detection, intensity analysis, and quantification
 */

export interface ImageAnalysisResult {
  image_type: string;
  detected_features: DetectedFeature[];
  quantification: QuantificationResult;
  quality_assessment: ImageQualityAssessment;
  suggested_analyses: string[];
  warnings: string[];
}

export interface DetectedFeature {
  id: string;
  type: string; // "band", "peak", "spot", etc.
  position: { x: number; y: number };
  intensity: number; // 0-255
  area: number;
  width: number;
  height: number;
  properties: Record<string, any>;
}

export interface QuantificationResult {
  total_intensity: number;
  average_intensity: number;
  peak_count: number;
  band_count: number;
  density_distribution: number[];
  molecular_weights?: number[]; // For gel blots
  retention_times?: number[]; // For chromatograms
}

export interface ImageQualityAssessment {
  quality_score: number; // 0-100
  contrast_level: string; // "low", "medium", "high"
  noise_level: string; // "low", "medium", "high"
  saturation_level: string; // "normal", "undersaturated", "oversaturated"
  issues: string[];
}

/**
 * Detect image type from filename or visual characteristics
 */
export function detectImageType(
  filename: string,
  imageData?: { width: number; height: number }
): string {
  const nameLower = filename.toLowerCase();

  if (
    nameLower.includes("gel") ||
    nameLower.includes("blot") ||
    nameLower.includes("western") ||
    nameLower.includes("sds")
  ) {
    return "gel_blot";
  }

  if (
    nameLower.includes("chromatogram") ||
    nameLower.includes("hplc") ||
    nameLower.includes("lc-ms") ||
    nameLower.includes("gc-ms")
  ) {
    return "chromatogram";
  }

  if (nameLower.includes("spectrum") || nameLower.includes("nmr")) {
    return "spectrum";
  }

  if (nameLower.includes("microscopy") || nameLower.includes("histology")) {
    return "microscopy";
  }

  // Default based on aspect ratio if available
  if (imageData) {
    const ratio = imageData.width / imageData.height;
    if (ratio > 2) return "chromatogram"; // Wide images often chromatograms
    if (ratio < 0.5) return "gel_blot"; // Tall images often gel blots
  }

  return "unknown";
}

/**
 * Simulate band detection for gel blots
 * In production, would use image processing libraries like OpenCV
 */
export function detectGelBands(
  imageWidth: number,
  imageHeight: number,
  imageIntensity: Uint8Array
): DetectedFeature[] {
  const bands: DetectedFeature[] = [];

  // Simulate band detection using intensity thresholding
  const threshold = 100;
  let currentBand: DetectedFeature | null = null;
  let bandId = 0;

  // Simplified: scan vertically for intensity peaks
  const verticalProfile = new Array(imageHeight).fill(0);

  for (let y = 0; y < imageHeight; y++) {
    let rowIntensity = 0;
    for (let x = 0; x < imageWidth; x++) {
      const pixelIdx = (y * imageWidth + x) * 4; // RGBA
      rowIntensity += imageIntensity[pixelIdx] || 0;
    }
    verticalProfile[y] = rowIntensity / imageWidth;
  }

  // Find peaks in vertical profile
  for (let y = 1; y < imageHeight - 1; y++) {
    const isLocalMax =
      verticalProfile[y] > verticalProfile[y - 1] &&
      verticalProfile[y] > verticalProfile[y + 1];

    if (isLocalMax && verticalProfile[y] > threshold) {
      if (!currentBand) {
        currentBand = {
          id: `band_${bandId++}`,
          type: "band",
          position: { x: imageWidth / 2, y },
          intensity: verticalProfile[y],
          area: 0,
          width: imageWidth,
          height: 0,
          properties: {},
        };
      }
    } else if (currentBand) {
      currentBand.height = y - currentBand.position.y;
      currentBand.area = currentBand.width * currentBand.height;
      bands.push(currentBand);
      currentBand = null;
    }
  }

  return bands;
}

/**
 * Simulate peak detection for chromatograms
 */
export function detectChromatogramPeaks(
  timePoints: number[],
  intensities: number[]
): DetectedFeature[] {
  const peaks: DetectedFeature[] = [];

  if (timePoints.length < 3) return peaks;

  let peakId = 0;

  for (let i = 1; i < intensities.length - 1; i++) {
    const isLocalMax =
      intensities[i] > intensities[i - 1] && intensities[i] > intensities[i + 1];

    if (isLocalMax && intensities[i] > 10) {
      // Threshold for peak detection
      // Calculate peak width (simplified)
      let leftWidth = 1;
      let rightWidth = 1;

      while (
        i - leftWidth >= 0 &&
        intensities[i - leftWidth] > intensities[i] * 0.5
      ) {
        leftWidth++;
      }

      while (
        i + rightWidth < intensities.length &&
        intensities[i + rightWidth] > intensities[i] * 0.5
      ) {
        rightWidth++;
      }

      const peakWidth = leftWidth + rightWidth;
      const retentionTime = timePoints[i];

      peaks.push({
        id: `peak_${peakId++}`,
        type: "peak",
        position: { x: retentionTime, y: intensities[i] },
        intensity: intensities[i],
        area: intensities[i] * peakWidth, // Simplified area calculation
        width: peakWidth,
        height: intensities[i],
        properties: {
          retention_time: retentionTime,
          peak_width: peakWidth,
          asymmetry: 1.0, // Would calculate from actual peak shape
        },
      });
    }
  }

  return peaks;
}

/**
 * Assess image quality
 */
export function assessImageQuality(
  imageData: Uint8Array,
  imageWidth: number,
  imageHeight: number
): ImageQualityAssessment {
  let qualityScore = 100;
  const issues: string[] = [];

  // Calculate contrast
  let minIntensity = 255;
  let maxIntensity = 0;
  let totalIntensity = 0;
  let pixelCount = 0;

  for (let i = 0; i < imageData.length; i += 4) {
    const intensity = imageData[i]; // R channel
    minIntensity = Math.min(minIntensity, intensity);
    maxIntensity = Math.max(maxIntensity, intensity);
    totalIntensity += intensity;
    pixelCount++;
  }

  const contrast = maxIntensity - minIntensity;
  const avgIntensity = totalIntensity / pixelCount;

  let contrastLevel = "medium";
  if (contrast < 50) {
    contrastLevel = "low";
    qualityScore -= 20;
    issues.push("Low contrast: bands/peaks may be difficult to detect");
  } else if (contrast > 200) {
    contrastLevel = "high";
  }

  // Assess saturation
  let saturationLevel = "normal";
  const saturatedPixels = Array.from(imageData).filter((v, i) => i % 4 === 0 && v > 240)
    .length;
  const saturationRatio = saturatedPixels / pixelCount;

  if (saturationRatio > 0.1) {
    saturationLevel = "oversaturated";
    qualityScore -= 15;
    issues.push("Image oversaturation: loss of signal detail");
  } else if (saturationRatio < 0.01) {
    saturationLevel = "undersaturated";
    qualityScore -= 10;
    issues.push("Image undersaturation: weak signal");
  }

  // Assess noise
  let noiseLevel = "low";
  // Simplified noise calculation: check pixel-to-pixel variation
  let totalVariation = 0;
  let variationCount = 0;

  for (let i = 0; i < imageData.length - 4; i += 4) {
    const diff = Math.abs(imageData[i] - imageData[i + 4]);
    totalVariation += diff;
    variationCount++;
  }

  const avgVariation = totalVariation / variationCount;

  if (avgVariation > 30) {
    noiseLevel = "high";
    qualityScore -= 15;
    issues.push("High noise level: may affect peak detection accuracy");
  } else if (avgVariation > 15) {
    noiseLevel = "medium";
    qualityScore -= 5;
  }

  qualityScore = Math.max(0, Math.min(100, qualityScore));

  return {
    quality_score: qualityScore,
    contrast_level: contrastLevel,
    noise_level: noiseLevel,
    saturation_level: saturationLevel,
    issues,
  };
}

/**
 * Quantify image features
 */
export function quantifyImageFeatures(
  features: DetectedFeature[]
): QuantificationResult {
  if (features.length === 0) {
    return {
      total_intensity: 0,
      average_intensity: 0,
      peak_count: 0,
      band_count: 0,
      density_distribution: [],
    };
  }

  const totalIntensity = features.reduce((sum, f) => sum + f.intensity, 0);
  const avgIntensity = totalIntensity / features.length;

  const bandCount = features.filter((f) => f.type === "band").length;
  const peakCount = features.filter((f) => f.type === "peak").length;

  // Create density distribution (histogram)
  const densityDistribution = new Array(10).fill(0);
  for (const feature of features) {
    const bin = Math.min(9, Math.floor((feature.intensity / 255) * 10));
    densityDistribution[bin]++;
  }

  return {
    total_intensity: totalIntensity,
    average_intensity: avgIntensity,
    peak_count: peakCount,
    band_count: bandCount,
    density_distribution: densityDistribution,
  };
}

/**
 * Generate suggested analyses based on image type
 */
export function generateImageAnalysisSuggestions(
  imageType: string,
  qualityScore: number
): string[] {
  const suggestions: string[] = [];

  if (qualityScore < 60) {
    suggestions.push("Image quality is suboptimal. Consider re-acquiring image.");
  }

  switch (imageType) {
    case "gel_blot":
      suggestions.push("Quantify band intensities for densitometry analysis");
      suggestions.push("Compare band patterns across samples");
      suggestions.push("Estimate molecular weights from band positions");
      suggestions.push("Perform densitometric analysis for relative quantification");
      break;

    case "chromatogram":
      suggestions.push("Identify and quantify individual peaks");
      suggestions.push("Calculate peak areas for compound quantification");
      suggestions.push("Assess peak purity and resolution");
      suggestions.push("Perform integration and area normalization");
      break;

    case "spectrum":
      suggestions.push("Identify spectral features and peaks");
      suggestions.push("Assess spectral quality and signal-to-noise ratio");
      suggestions.push("Compare with reference spectra");
      break;

    case "microscopy":
      suggestions.push("Perform cell counting or morphological analysis");
      suggestions.push("Assess tissue staining intensity");
      suggestions.push("Quantify fluorescence signal");
      break;

    default:
      suggestions.push("Perform general image analysis");
  }

  return suggestions;
}

/**
 * Analyze image (main entry point)
 */
export function analyzeImage(
  filename: string,
  imageData: Uint8Array,
  imageWidth: number,
  imageHeight: number,
  additionalData?: { timePoints?: number[]; intensities?: number[] }
): ImageAnalysisResult {
  const imageType = detectImageType(filename, { width: imageWidth, height: imageHeight });
  const qualityAssessment = assessImageQuality(imageData, imageWidth, imageHeight);

  let detectedFeatures: DetectedFeature[] = [];

  if (imageType === "gel_blot") {
    detectedFeatures = detectGelBands(imageWidth, imageHeight, imageData);
  } else if (imageType === "chromatogram" && additionalData?.timePoints && additionalData?.intensities) {
    detectedFeatures = detectChromatogramPeaks(
      additionalData.timePoints,
      additionalData.intensities
    );
  }

  const quantification = quantifyImageFeatures(detectedFeatures);
  const suggestedAnalyses = generateImageAnalysisSuggestions(
    imageType,
    qualityAssessment.quality_score
  );

  const warnings: string[] = [];
  if (qualityAssessment.quality_score < 60) {
    warnings.push("Image quality is low. Results should be interpreted with caution.");
  }
  if (detectedFeatures.length === 0) {
    warnings.push("No features detected. Image may be blank or require preprocessing.");
  }

  return {
    image_type: imageType,
    detected_features: detectedFeatures,
    quantification,
    quality_assessment: qualityAssessment,
    suggested_analyses: suggestedAnalyses,
    warnings,
  };
}
