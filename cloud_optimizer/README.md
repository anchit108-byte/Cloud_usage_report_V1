# AI-Based Cloud Usage and Cloud Cost Optimization System

A modular, full-stack cloud usage and cost optimization system built with **Streamlit**, **FastAPI**, **Pandas**, **NumPy**, **Scikit-learn**, **Matplotlib**, and **SQLite**.

## Project Structure & File Responsibilities

```text
cloud_optimizer/
├── frontend/
│   ├── app.py                     # Streamlit Home page: CSV upload, validation, progress bar, 3s blinking success, history, report navigation
│   ├── pages/
│   │   └── report.py              # Dedicated Report page: overall cost/utilization KPIs, dynamic charts, ML status, findings, recommendations
│   └── components/
│       ├── theme.py               # White & Blue styling, Light/Dark mode switch, 3-second blinking success banner CSS
│       └── charts.py              # Dynamic Matplotlib grouped bar charts (Usage vs Cost, Current vs Previous Year) and breakdowns
├── backend/
│   ├── main.py                    # FastAPI app entrypoint, CORS setup, empty SQLite DB initialization on startup
│   ├── models.py                  # Pydantic response schemas
│   ├── database.py                # SQLite persistence layer (uploads, normalized records, reports) starting strictly empty
│   ├── ml_model.py                # Dedicated Scikit-learn LinearRegression interface (TODO hooks; never fabricates predictions)
│   ├── routes/
│   │   ├── upload.py              # POST /api/upload executing full processing pipeline & deduplication
│   │   └── reports.py             # GET /api/history, /api/reports/latest, /api/reports/{id}, DELETE /api/uploads/{id}
│   └── services/
│       ├── csv_validator.py       # Structural CSV validation & SHA-256 file hashing
│       ├── column_detector.py     # Automatic multi-schema column detection with explicit ambiguity reporting
│       ├── data_cleaner.py        # Pandas data cleaning, currency/percentage parsing, deduplication
│       ├── analytics.py           # NumPy statistical summaries, Usage vs Cost, Year-over-Year, breakdowns & trends
│       ├── recommendation_engine.py # CONTINUE / OPTIMIZE / DISCONTINUE classification with evidence checks
│       └── report_generator.py    # Findings compilation and structured optimization report assembly
├── requirements.txt               # Python package dependencies
└── README.md                      # Setup and execution guide
```

## Setup & Execution Instructions

1. **Create and activate a virtual environment**
   ```bash
   cd cloud_optimizer
   python -m venv .venv
   source .venv/bin/activate   # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Start the FastAPI Backend**
   ```bash
   cd backend
   uvicorn main:app --reload --port 8000
   ```

3. **Start the Streamlit Frontend (in a second terminal)**
   ```bash
   cd frontend
   streamlit run app.py --server.port 8501
   ```

4. **Using the Application**
   - Fresh installs start with an **empty SQLite database** (`"No data available. Upload a CSV file to begin analysis."`).
   - Upload any AWS CUR, Cost Explorer, CloudWatch, or custom cloud usage/billing CSV.
   - Ambiguous or missing columns are reported honestly instead of being guessed or fabricated.
   - `backend/ml_model.py` reserves `LinearRegression` forecasting interfaces cleanly for future training on accumulated historical records.
