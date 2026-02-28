/**
 * Machine Learning Basics Module
 * Random Forests, K-means clustering, feature importance, cross-validation
 */

// ============ Random Forest Implementation ============

interface TreeNode {
  feature?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
  value?: number; // For leaf nodes
  samples?: number;
}

interface RandomForestResult {
  type: "classification" | "regression";
  nTrees: number;
  accuracy?: number;
  mse?: number;
  oobError?: number;
  featureImportances: Array<{ feature: number; importance: number }>;
  predictions: number[];
  cvScores: number[];
  plotData: {
    importances: Array<{ name: string; importance: number }>;
    oobError: number;
  };
}

/**
 * Build a single decision tree using CART algorithm
 */
function buildDecisionTree(
  X: number[][],
  y: number[],
  depth: number = 0,
  maxDepth: number = 10,
  minSamplesSplit: number = 2,
  isClassification: boolean = false
): TreeNode {
  const n = X.length;
  const nFeatures = X[0].length;

  // Stopping criteria
  if (
    n < minSamplesSplit ||
    depth >= maxDepth ||
    new Set(y).size === 1
  ) {
    return {
      value: isClassification
        ? Math.round(y.reduce((a, b) => a + b, 0) / n)
        : y.reduce((a, b) => a + b, 0) / n,
      samples: n,
    };
  }

  let bestGain = 0;
  let bestFeature = 0;
  let bestThreshold = 0;
  let bestLeftIndices: number[] = [];
  let bestRightIndices: number[] = [];

  // Find best split
  for (let feature = 0; feature < nFeatures; feature++) {
    const values = X.map((row) => row[feature]);
    const uniqueValues = Array.from(new Set(values)).sort((a, b) => a - b);

    for (let i = 0; i < uniqueValues.length - 1; i++) {
      const threshold = (uniqueValues[i] + uniqueValues[i + 1]) / 2;

      const leftIndices = X.map((row, idx) =>
        row[feature] <= threshold ? idx : -1
      ).filter((idx) => idx !== -1);
      const rightIndices = X.map((row, idx) =>
        row[feature] > threshold ? idx : -1
      ).filter((idx) => idx !== -1);

      if (leftIndices.length === 0 || rightIndices.length === 0) continue;

      const leftY = leftIndices.map((idx) => y[idx]);
      const rightY = rightIndices.map((idx) => y[idx]);

      let gain = 0;
      if (isClassification) {
        const parentGini = calculateGini(y);
        const leftGini = calculateGini(leftY);
        const rightGini = calculateGini(rightY);
        gain =
          parentGini -
          ((leftY.length / n) * leftGini + (rightY.length / n) * rightGini);
      } else {
        const parentVar = calculateVariance(y);
        const leftVar = calculateVariance(leftY);
        const rightVar = calculateVariance(rightY);
        gain =
          parentVar -
          ((leftY.length / n) * leftVar + (rightY.length / n) * rightVar);
      }

      if (gain > bestGain) {
        bestGain = gain;
        bestFeature = feature;
        bestThreshold = threshold;
        bestLeftIndices = leftIndices;
        bestRightIndices = rightIndices;
      }
    }
  }

  if (bestGain === 0) {
    return {
      value: isClassification
        ? Math.round(y.reduce((a, b) => a + b, 0) / n)
        : y.reduce((a, b) => a + b, 0) / n,
      samples: n,
    };
  }

  const leftX = bestLeftIndices.map((idx) => X[idx]);
  const leftY = bestLeftIndices.map((idx) => y[idx]);
  const rightX = bestRightIndices.map((idx) => X[idx]);
  const rightY = bestRightIndices.map((idx) => y[idx]);

  return {
    feature: bestFeature,
    threshold: bestThreshold,
    left: buildDecisionTree(
      leftX,
      leftY,
      depth + 1,
      maxDepth,
      minSamplesSplit,
      isClassification
    ),
    right: buildDecisionTree(
      rightX,
      rightY,
      depth + 1,
      maxDepth,
      minSamplesSplit,
      isClassification
    ),
    samples: n,
  };
}

/**
 * Random Forest: Ensemble of decision trees
 */
export function randomForest(
  X: number[][],
  y: number[],
  nTrees: number = 100,
  isClassification: boolean = true,
  cvFolds: number = 5
): RandomForestResult {
  const n = X.length;
  const nFeatures = X[0].length;
  const trees: TreeNode[] = [];
  const featureImportances = Array(nFeatures).fill(0);
  const predictions = Array(n).fill(0);
  const oobPredictions = Array(n).fill(0);
  const oobCounts = Array(n).fill(0);

  // Bootstrap aggregating
  for (let t = 0; t < nTrees; t++) {
    const bootIndices: number[] = [];
    const oobIndices: Set<number> = new Set(Array.from({ length: n }, (_, i) => i));

    for (let i = 0; i < n; i++) {
      const idx = Math.floor(Math.random() * n);
      bootIndices.push(idx);
      oobIndices.delete(idx);
    }

    const bootX = bootIndices.map((idx) => X[idx]);
    const bootY = bootIndices.map((idx) => y[idx]);

    const tree = buildDecisionTree(bootX, bootY, 0, 10, 2, isClassification);
    trees.push(tree);

    // OOB error estimation
    for (const idx of Array.from(oobIndices)) {
      const pred = predictTree(tree, X[idx]);
      oobPredictions[idx] += pred;
      oobCounts[idx]++;
    }
  }

  // Average predictions
  for (let i = 0; i < n; i++) {
    if (oobCounts[i] > 0) {
      predictions[i] =
        oobPredictions[i] / oobCounts[i];
      if (isClassification) {
        predictions[i] = Math.round(predictions[i]);
      }
    }
  }

  // Calculate OOB error
  let oobError = 0;
  let oobCount = 0;
  for (let i = 0; i < n; i++) {
    if (oobCounts[i] > 0) {
      if (isClassification) {
        oobError += predictions[i] !== y[i] ? 1 : 0;
      } else {
        oobError += Math.pow(predictions[i] - y[i], 2);
      }
      oobCount++;
    }
  }
  oobError = oobError / Math.max(oobCount, 1);

  // Feature importance (Gini/MDI)
  for (let f = 0; f < nFeatures; f++) {
    let importance = 0;
    for (const tree of trees) {
      importance += calculateTreeImportance(tree, f);
    }
    featureImportances[f] = importance / nTrees;
  }

  // Normalize importances
  const totalImportance = featureImportances.reduce((a, b) => a + b, 0);
  const normalizedImportances = featureImportances.map(
    (imp) => imp / Math.max(totalImportance, 0.001)
  );

  // Cross-validation
  const cvScores = crossValidation(X, y, cvFolds, isClassification);

  // Calculate accuracy/MSE
  let accuracy = 0;
  let mse = 0;
  for (let i = 0; i < n; i++) {
    if (isClassification) {
      accuracy += predictions[i] === y[i] ? 1 : 0;
    } else {
      mse += Math.pow(predictions[i] - y[i], 2);
    }
  }
  accuracy = accuracy / n;
  mse = mse / n;

  return {
    type: isClassification ? "classification" : "regression",
    nTrees,
    accuracy: isClassification ? accuracy : undefined,
    mse: !isClassification ? mse : undefined,
    oobError,
    featureImportances: normalizedImportances.map((imp, idx) => ({
      feature: idx,
      importance: imp,
    })),
    predictions,
    cvScores,
    plotData: {
      importances: normalizedImportances.map((imp, idx) => ({
        name: `Feature ${idx}`,
        importance: imp,
      })),
      oobError,
    },
  };
}

// ============ K-Means Clustering ============

interface KMeansResult {
  nClusters: number;
  centroids: number[][];
  assignments: number[];
  silhouetteScore: number;
  inertia: number;
  plotData: Array<{ x: number; y: number; cluster: number }>;
  elbowData: Array<{ k: number; inertia: number }>;
}

/**
 * K-Means clustering with elbow method
 */
export function kMeansClustering(
  X: number[][],
  maxK: number = 10
): KMeansResult {
  const n = X.length;
  const nFeatures = X[0].length;

  // Find optimal k using elbow method
  const elbowData: Array<{ k: number; inertia: number }> = [];
  let bestK = 2;
  let bestInertia = Infinity;

  for (let k = 1; k <= Math.min(maxK, n); k++) {
    const result = kMeansIterate(X, k);
    elbowData.push({ k, inertia: result.inertia });

    if (result.inertia < bestInertia) {
      bestInertia = result.inertia;
      bestK = k;
    }
  }

  // Run k-means with optimal k
  const finalResult = kMeansIterate(X, bestK);

  // Calculate silhouette score
  const silhouetteScore = calculateSilhouetteScore(
    X,
    finalResult.assignments,
    finalResult.centroids
  );

  // Generate plot data (use first 2 features for visualization)
  const plotData = X.map((point, idx) => ({
    x: point[0],
    y: nFeatures > 1 ? point[1] : 0,
    cluster: finalResult.assignments[idx],
  }));

  return {
    nClusters: bestK,
    centroids: finalResult.centroids,
    assignments: finalResult.assignments,
    silhouetteScore,
    inertia: finalResult.inertia,
    plotData,
    elbowData,
  };
}

/**
 * K-Means iteration
 */
function kMeansIterate(
  X: number[][],
  k: number,
  maxIter: number = 100
): { centroids: number[][]; assignments: number[]; inertia: number } {
  const n = X.length;
  const nFeatures = X[0].length;

  // Initialize centroids
  let centroids: number[][] = [];
  for (let i = 0; i < k; i++) {
    centroids.push(X[Math.floor(Math.random() * n)].slice());
  }

  let assignments = Array(n).fill(0);
  let converged = false;
  let iter = 0;

  while (!converged && iter < maxIter) {
    // Assign points to nearest centroid
    const newAssignments = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let minDist = Infinity;
      let bestCluster = 0;
      for (let c = 0; c < k; c++) {
        const dist = euclideanDistance(X[i], centroids[c]);
        if (dist < minDist) {
          minDist = dist;
          bestCluster = c;
        }
      }
      newAssignments[i] = bestCluster;
    }

    // Update centroids
    const newCentroids: number[][] = [];
    for (let c = 0; c < k; c++) {
      const clusterPoints = X.filter((_, idx) => newAssignments[idx] === c);
      if (clusterPoints.length === 0) {
        newCentroids.push(centroids[c].slice());
      } else {
        const centroid = Array(nFeatures).fill(0);
        for (let f = 0; f < nFeatures; f++) {
          centroid[f] =
            clusterPoints.reduce((sum, point) => sum + point[f], 0) /
            clusterPoints.length;
        }
        newCentroids.push(centroid);
      }
    }

    // Check convergence
    converged = centroids.every((c, idx) =>
      c.every((val, f) => Math.abs(val - newCentroids[idx][f]) < 1e-4)
    );

    centroids = newCentroids;
    assignments = newAssignments;
    iter++;
  }

  // Calculate inertia
  let inertia = 0;
  for (let i = 0; i < n; i++) {
    inertia += Math.pow(
      euclideanDistance(X[i], centroids[assignments[i]]),
      2
    );
  }

  return { centroids, assignments, inertia };
}

// ============ Helper Functions ============

function calculateGini(y: number[]): number {
  const n = y.length;
  const counts: Record<number, number> = {};
  for (const val of y) {
    counts[val] = (counts[val] || 0) + 1;
  }
  let gini = 1;
  for (const count of Object.values(counts)) {
    gini -= Math.pow(count / n, 2);
  }
  return gini;
}

function calculateVariance(y: number[]): number {
  const mean = y.reduce((a, b) => a + b, 0) / y.length;
  return (
    y.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / y.length
  );
}

function predictTree(tree: TreeNode, x: number[]): number {
  if (tree.value !== undefined) {
    return tree.value;
  }
  if (tree.feature === undefined || tree.threshold === undefined) {
    return 0;
  }
  if (x[tree.feature] <= tree.threshold) {
    return tree.left ? predictTree(tree.left, x) : 0;
  } else {
    return tree.right ? predictTree(tree.right, x) : 0;
  }
}

function calculateTreeImportance(tree: TreeNode, feature: number): number {
  if (tree.value !== undefined) {
    return 0;
  }
  let importance = 0;
  if (tree.feature === feature && tree.samples !== undefined) {
    importance = 1 / tree.samples;
  }
  if (tree.left) {
    importance += calculateTreeImportance(tree.left, feature);
  }
  if (tree.right) {
    importance += calculateTreeImportance(tree.right, feature);
  }
  return importance;
}

function euclideanDistance(a: number[], b: number[]): number {
  return Math.sqrt(
    a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0)
  );
}

function calculateSilhouetteScore(
  X: number[][],
  assignments: number[],
  centroids: number[][]
): number {
  const n = X.length;
  let totalScore = 0;

  for (let i = 0; i < n; i++) {
    const cluster = assignments[i];
    const a = calculateIntraClusterDistance(X, assignments, i);
    const b = calculateInterClusterDistance(X, assignments, centroids, i);
    const s = (b - a) / Math.max(a, b, 0.001);
    totalScore += s;
  }

  return totalScore / n;
}

function calculateIntraClusterDistance(
  X: number[][],
  assignments: number[],
  pointIdx: number
): number {
  const cluster = assignments[pointIdx];
  const clusterPoints = X.filter((_, idx) => assignments[idx] === cluster);
  if (clusterPoints.length <= 1) return 0;

  let totalDist = 0;
  for (const point of clusterPoints) {
    if (point !== X[pointIdx]) {
      totalDist += euclideanDistance(X[pointIdx], point);
    }
  }
  return totalDist / Math.max(clusterPoints.length - 1, 1);
}

function calculateInterClusterDistance(
  X: number[][],
  assignments: number[],
  centroids: number[][],
  pointIdx: number
): number {
  const cluster = assignments[pointIdx];
  let minDist = Infinity;

  for (let c = 0; c < centroids.length; c++) {
    if (c !== cluster) {
      const dist = euclideanDistance(X[pointIdx], centroids[c]);
      minDist = Math.min(minDist, dist);
    }
  }

  return minDist;
}

function crossValidation(
  X: number[][],
  y: number[],
  folds: number = 5,
  isClassification: boolean = true
): number[] {
  const n = X.length;
  const foldSize = Math.floor(n / folds);
  const scores: number[] = [];

  for (let fold = 0; fold < folds; fold++) {
    const testStart = fold * foldSize;
    const testEnd = fold === folds - 1 ? n : (fold + 1) * foldSize;

    const testX = X.slice(testStart, testEnd);
    const testY = y.slice(testStart, testEnd);
    const trainX = [...X.slice(0, testStart), ...X.slice(testEnd)];
    const trainY = [...y.slice(0, testStart), ...y.slice(testEnd)];

    // Train simple model and evaluate
    const result = randomForest(trainX, trainY, 10, isClassification, 0);
    let score = 0;

    if (isClassification) {
      for (let i = 0; i < testX.length; i++) {
        const pred = result.predictions[i];
        score += pred === testY[i] ? 1 : 0;
      }
      score = score / testX.length;
    } else {
      for (let i = 0; i < testX.length; i++) {
        score += Math.pow(result.predictions[i] - testY[i], 2);
      }
      score = Math.sqrt(score / testX.length);
    }

    scores.push(score);
  }

  return scores;
}
