# Data Scale Classification Reference

## Overview

Data scales determine which statistical methods are appropriate. This reference helps classify columns and suggest analysis methods.

## Four Scales of Measurement

### 1. Nominal (Categorical)

**Definition:** Categories with no inherent order. No meaningful distance between categories.

**Examples:**
- Gender (Male, Female, Other)
- Treatment group (Drug A, Drug B, Placebo)
- Disease status (Yes, No)
- Country (USA, Canada, UK)
- Diagnosis codes (ICD-10)

**Characteristics:**
- Only equality/inequality comparisons
- No ordering
- No arithmetic operations

**Appropriate Statistics:**
- Mode (most frequent category)
- Frequency tables
- Chi-square test (comparing proportions)
- Fisher's exact test
- Contingency tables

**Inappropriate:**
- Mean, median, std dev
- t-tests
- Correlation

---

### 2. Ordinal (Ranked)

**Definition:** Categories with meaningful order, but distances between categories are not equal.

**Examples:**
- Severity (Mild, Moderate, Severe)
- Pain scale (None, Mild, Moderate, Severe, Extreme)
- Education level (High School, Bachelor's, Master's, PhD)
- Likert scale (Strongly Disagree, Disagree, Neutral, Agree, Strongly Agree)
- Disease stage (Stage I, II, III, IV)
- Response (Poor, Fair, Good, Excellent)

**Characteristics:**
- Meaningful order
- Unequal intervals (difference between Mild and Moderate ≠ Moderate and Severe)
- No true zero point

**Appropriate Statistics:**
- Median (not mean)
- Mode
- Percentiles
- Mann-Whitney U test (comparing two groups)
- Kruskal-Wallis test (comparing 3+ groups)
- Spearman's rank correlation
- Ordinal logistic regression

**Inappropriate:**
- Mean (unless treating as interval, with caution)
- Standard deviation
- Pearson correlation
- t-tests (use Mann-Whitney instead)

---

### 3. Interval (Continuous, Equal Spacing)

**Definition:** Ordered scale with equal intervals, but no true zero point.

**Examples:**
- Temperature (Celsius, Fahrenheit) - 0°C ≠ no temperature
- Calendar year
- pH scale
- IQ scores
- Test scores (0-100)
- Dates (distance between dates is meaningful)

**Characteristics:**
- Equal intervals
- No true zero
- Ratios not meaningful (20°C is not "twice as hot" as 10°C)
- Can be negative

**Appropriate Statistics:**
- Mean, median, mode
- Standard deviation, variance
- Pearson correlation
- t-tests
- ANOVA
- Linear regression
- Confidence intervals

**Inappropriate:**
- Ratios (20°C is not 2x 10°C)
- Geometric mean
- Coefficient of variation (without caution)

---

### 4. Ratio (Continuous, True Zero)

**Definition:** Ordered scale with equal intervals AND a true zero point. Highest level of measurement.

**Examples:**
- Age (years)
- Weight (kg, lbs)
- Height (cm, inches)
- Time (seconds, minutes, hours)
- Concentration (mg/mL)
- Blood pressure (mmHg)
- Dose (mg)
- Survival time (months)
- Lab values (glucose, cholesterol, etc.)
- Count data (number of adverse events)

**Characteristics:**
- True zero point (0 kg = no weight)
- Equal intervals
- Ratios are meaningful (10 kg is twice 5 kg)
- All arithmetic operations valid

**Appropriate Statistics:**
- All statistics from interval scale
- Geometric mean
- Coefficient of variation
- Ratios and proportions
- Log transformation (if skewed)
- Survival analysis (for time-to-event)

---

## Decision Tree: Classifying a Column

```
1. Are categories ordered?
   NO  → NOMINAL
   YES → Go to 2

2. Are intervals equal?
   NO  → ORDINAL
   YES → Go to 3

3. Is there a true zero point?
   NO  → INTERVAL
   YES → RATIO
```

---

## Pharmaceutical Context: Common Data Types

| Column Type | Scale | Example | Analysis |
|-------------|-------|---------|----------|
| Patient ID | Nominal | 001, 002, 003 | Identifier only |
| Treatment Group | Nominal | Drug A, Placebo | Chi-square, Fisher's exact |
| Adverse Event | Nominal | Headache, Nausea | Frequency, proportions |
| Severity | Ordinal | Mild, Moderate, Severe | Mann-Whitney, Kruskal-Wallis |
| Response | Ordinal | Poor, Fair, Good, Excellent | Ordinal logistic regression |
| Age | Ratio | 45, 67, 23 | t-test, ANOVA, correlation |
| Dose | Ratio | 5 mg, 10 mg, 20 mg | Dose-response analysis |
| Baseline Value | Ratio | 120, 145, 98 | t-test, ANCOVA |
| Time to Event | Ratio | 120 days, 365 days | Kaplan-Meier, Cox regression |
| Lab Value | Ratio | 5.2 mg/dL, 7.1 mg/dL | t-test, correlation, regression |
| Visit Date | Interval | 2024-01-15 | Time-based analysis |

---

## Statistical Method Selector

### Comparing Two Groups

| Scale | Method | Test |
|-------|--------|------|
| Nominal | Proportions | Chi-square or Fisher's exact |
| Ordinal | Ranks | Mann-Whitney U test |
| Interval/Ratio | Means (normal) | Independent t-test |
| Interval/Ratio | Means (non-normal) | Mann-Whitney U or Welch's t-test |

### Comparing 3+ Groups

| Scale | Method | Test |
|-------|--------|------|
| Nominal | Proportions | Chi-square |
| Ordinal | Ranks | Kruskal-Wallis |
| Interval/Ratio | Means (normal) | One-way ANOVA |
| Interval/Ratio | Means (non-normal) | Kruskal-Wallis |

### Correlation/Association

| Scale | Method | Test |
|-------|--------|------|
| Nominal × Nominal | Association | Chi-square, Cramér's V |
| Ordinal × Ordinal | Rank correlation | Spearman's rho |
| Interval/Ratio × Interval/Ratio | Linear correlation | Pearson's r |

### Time-to-Event Analysis

| Data Type | Method |
|-----------|--------|
| Survival times + censoring | Kaplan-Meier curves |
| Comparing survival curves | Log-rank test |
| Adjusting for covariates | Cox proportional hazards |

---

## Auto-Detection Algorithm

When parsing CSV/Excel files, use these heuristics:

```
1. Check column name for keywords:
   - "time", "date", "age", "duration" → Likely RATIO
   - "severity", "stage", "grade" → Likely ORDINAL
   - "group", "treatment", "category" → Likely NOMINAL

2. Check data type:
   - All text/strings → NOMINAL or ORDINAL
   - All numbers → INTERVAL or RATIO
   - Mix of text and numbers → NOMINAL

3. Check unique values:
   - < 10 unique values + text → NOMINAL or ORDINAL
   - > 50 unique values + numbers → RATIO
   - 10-50 unique values → Check range and context

4. Check for true zero:
   - If min value = 0 and column is numeric → RATIO
   - If min value < 0 → INTERVAL
   - If all positive and > 0 → RATIO

5. Manual override:
   - Allow user to specify scale if auto-detection uncertain
```

---

## References

- Stevens, S. S. (1946). On the theory of scales of measurement. Science, 103(2684), 677-680.
- ICH E9 Statistical Principles for Clinical Trials
- FDA Guidance on Statistical Principles for Clinical Trials
