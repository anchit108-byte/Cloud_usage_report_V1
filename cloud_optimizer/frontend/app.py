import os
import time
import requests
import streamlit as st

from components.theme import apply_theme_css, render_theme_toggle

API_BASE_URL = os.environ.get("CLOUD_OPTIMIZER_API_URL", "http://127.0.0.1:8000")

st.set_page_config(
    page_title="CloudOptix — Cloud Usage & Cost Optimization",
    layout="wide",
)

apply_theme_css()

top_left, top_right = st.columns([4, 1])
with top_left:
    st.title("AI-Based Cloud Usage and Cloud Cost Optimization System")
    st.markdown(
        "Upload cloud usage and billing CSV exports to automatically detect metrics, clean telemetry, "
        "run numerical analysis, and generate evidence-backed optimization recommendations."
    )
with top_right:
    render_theme_toggle()

st.divider()

# Upload Section
st.header("Upload Cloud Usage & Billing CSV")
uploaded_file = st.file_uploader("Select a cloud billing or usage CSV file", type=["csv"])

if uploaded_file is not None:
    file_size_kb = len(uploaded_file.getvalue()) / 1024.0
    if len(uploaded_file.getvalue()) == 0:
        st.error("File Validation Status: Uploaded CSV file is empty.")
    else:
        st.info(f"File Validation Status: Ready ({uploaded_file.name}, {file_size_kb:.1f} KB)")

    if st.button("Analyze & Generate Report", type="primary", disabled=len(uploaded_file.getvalue()) == 0):
        progress = st.progress(0, text="Uploading CSV to FastAPI backend...")
        try:
            stages = [
                (15, "Validating CSV structure..."),
                (35, "Cleaning data with Pandas..."),
                (55, "Detecting columns & schemas..."),
                (75, "Running NumPy numerical analysis & ML interface check..."),
                (90, "Generating recommendations & persisting to SQLite..."),
            ]
            for pct, label in stages:
                progress.progress(pct, text=label)
                time.sleep(0.08)

            response = requests.post(
                f"{API_BASE_URL}/api/upload",
                files={"file": (uploaded_file.name, uploaded_file.getvalue(), "text/csv")},
                timeout=60,
            )

            if response.status_code >= 400:
                progress.empty()
                st.error(f"Validation/Analysis Error: {response.text}")
            else:
                payload = response.json()
                progress.progress(100, text="Analysis complete.")
                st.session_state["active_report"] = payload["report"]
                st.markdown(
                    '<div class="blink-success-3s">Report generated successfully and persisted to SQLite history.</div>',
                    unsafe_allow_html=True,
                )
        except Exception as exc:
            progress.empty()
            st.error(f"Backend API communication error: {exc}")

st.divider()

# Historical Records Section (Empty initially)
st.header("Historical Uploads & Reports")
try:
    hist_resp = requests.get(f"{API_BASE_URL}/api/history", timeout=10)
    history_items = hist_resp.json().get("items", []) if hist_resp.ok else []
except Exception:
    history_items = []
    st.warning("Unable to reach FastAPI backend to load persisted SQLite history.")

if not history_items:
    st.info("No data available. Upload a CSV file to begin analysis.")
else:
    for item in history_items:
        cols = st.columns([3, 2, 1, 1])
        cols[0].write(f"**{item['filename']}**")
        cols[1].write(f"Uploaded: {item['uploaded_at'][:19]} · Rows: {item['cleaned_row_count']}")
        cost_str = f"${item['total_cost']:,.2f}" if item.get("total_cost") is not None else "N/A"
        cols[2].write(f"Cost: {cost_str}")
        if cols[3].button("Open Report", key=f"open_{item['report_id']}"):
            r = requests.get(f"{API_BASE_URL}/api/reports/{item['report_id']}", timeout=10)
            if r.ok:
                st.session_state["active_report"] = r.json().get("report")
                st.switch_page("pages/report.py")

st.divider()

# Bottom Report Navigation Section
st.header("Report")
st.write("Navigate to the dedicated Report page to inspect dynamic charts, ML status, findings, and recommendations.")
if st.button("Go to Report Page"):
    st.switch_page("pages/report.py")
