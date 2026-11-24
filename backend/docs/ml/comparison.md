Test set: 118 rows (stratified 20%, seed 42). Tree max_depth = 8 (5-fold CV); forests: 50 trees, max_depth 8, 3 features per split.

| Model | Accuracy | Precision (macro) | Recall (macro) | F1 (macro) | F1 easy | F1 moderate | F1 hard | F1 risky |
|---|---|---|---|---|---|---|---|---|
| Our decision tree | 0.669 | 0.701 | 0.672 | 0.678 | 0.821 | 0.526 | 0.603 | 0.760 |
| Our random forest | 0.814 | 0.835 | 0.813 | 0.815 | 0.918 | 0.814 | 0.735 | 0.792 |
| scikit-learn decision tree | 0.661 | 0.696 | 0.663 | 0.669 | 0.821 | 0.526 | 0.595 | 0.735 |
| scikit-learn random forest | 0.805 | 0.812 | 0.806 | 0.807 | 0.949 | 0.774 | 0.698 | 0.808 |
