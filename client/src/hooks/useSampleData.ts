import { useEffect } from 'react';
import { useBiostatStore, DataRow } from '@/stores/biostatStore';

export const useSampleData = () => {
  const { setData } = useBiostatStore();

  const loadSampleData = () => {
    const sampleData: DataRow[] = [
      {
        name: 'Week 1',
        Age: 45,
        Weight: 75.5,
        BloodPressure: 120,
        HeartRate: 72,
        LabValue1: 8.5,
        LabValue2: 42.3,
      },
      {
        name: 'Week 2',
        Age: 52,
        Weight: 82.3,
        BloodPressure: 125,
        HeartRate: 78,
        LabValue1: 9.2,
        LabValue2: 45.1,
      },
      {
        name: 'Week 3',
        Age: 38,
        Weight: 68.9,
        BloodPressure: 118,
        HeartRate: 70,
        LabValue1: 7.8,
        LabValue2: 40.2,
      },
      {
        name: 'Week 4',
        Age: 61,
        Weight: 88.2,
        BloodPressure: 135,
        HeartRate: 82,
        LabValue1: 10.1,
        LabValue2: 48.5,
      },
      {
        name: 'Week 5',
        Age: 43,
        Weight: 71.4,
        BloodPressure: 122,
        HeartRate: 75,
        LabValue1: 8.9,
        LabValue2: 43.7,
      },
      {
        name: 'Week 6',
        Age: 55,
        Weight: 85.6,
        BloodPressure: 128,
        HeartRate: 80,
        LabValue1: 9.5,
        LabValue2: 46.8,
      },
      {
        name: 'Week 7',
        Age: 49,
        Weight: 79.1,
        BloodPressure: 121,
        HeartRate: 73,
        LabValue1: 8.6,
        LabValue2: 41.9,
      },
      {
        name: 'Week 8',
        Age: 58,
        Weight: 87.3,
        BloodPressure: 132,
        HeartRate: 81,
        LabValue1: 9.8,
        LabValue2: 47.2,
      },
    ];

    const columns = [
      'name',
      'Age',
      'Weight',
      'BloodPressure',
      'HeartRate',
      'LabValue1',
      'LabValue2',
    ];

    setData(sampleData, columns, 'Sample Clinical Trial Data');
  };

  return { loadSampleData };
};
