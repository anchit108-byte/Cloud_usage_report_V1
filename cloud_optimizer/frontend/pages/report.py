import os
import requests
import streamlit as st

from components.charts import (
    render_breakdown_chart,
    render_usage_vs_cost_chart,
    render_year_over_year_chart,
)
from components.theme import apply_theme_css, render_theme_toggle

API_BASE_URL = os.environ.get("CLOUD_OPTIMIZER_API_URL", "http://127.0.0.1:8000")

st.set_page_config(page_title="Optimization Report — CloudOptix", layout="wide")
apply_theme_css()

top_l, top_r = st.columns([4, 1])
with top_l:
    st.title("Cloud Usage & Cost Optimization Report")
with top_r:
    render_theme_toggle()

report = st.session_state.get("active_report")
if not report:
    try:
        resp = requests.get(f"{API_BASE_URL}/api/reports/latest", timeout=10)
        if resp.ok:
            report = resp.json().get("report")
    except Exception:
        report = None

if not report:
    st.info("No data available. Upload a CSV file to begin analysis.")
    if st.button("Return to Home Page"):
        st.switch_page("app.py")
    st.stop()

is_dark = st.session_state.get("theme_mode") == "dark"
analytics = report["analytics"]

st.caption(f"File: {report['filename']} · Created: {report['created_at']}")

# Overall Cost & Resource Utilization KPIs
st.header("Overall Cloud Cost & Utilization Analysis")
k1, k2, k3, k4 = st.columns(4)
total_cost = analytics.get("total_cost")
k1.metric("Total Cloud Cost", f"${total_cost['sum']:,.2f}" if total_cost else "Unavailable")
cpu = analytics.get("cpu_stats")
k2.metric("Average CPU Utilization", f"{cpu['mean']}%" if cpu else "Unavailable")
ram = analytics.get("ram_stats")
k3.metric("Average RAM Utilization", f"{ram['mean']}%" if ram else "Unavailable")
storage = analytics.get("storage_stats")
k4.metric("Total Storage", f"{storage['sum']:,.1f} GB" if storage else "Unavailable")

# Dynamic Charts
render_usage_vs_cost_chart(analytics.get("usage_vs_cost", {}), is_dark)
render_year_over_year_chart(analytics.get("year_over_year", {}), is_dark)

c1, c2 = st.columns(2)
with c1:
    render_breakdown_chart(
        "Service-wise Cost Breakdown",
        analytics.get("service_breakdown", []),
        "Service or Cost metric unavailable.",
        is_dark,
    )
with c2:
    render_breakdown_chart(
        "Region-wise Cost Breakdown",
        analytics.get("region_breakdown", []),
        "Region or Cost metric unavailable.",
        is_dark,
    )

# ML Status
st.header("ML Cost Forecasting Interface (ml_model.py)")
ml_status = report["ml_status"]
st.warning(ml_status["message"])

# Findings
st.header("Important Findings")
for finding in report.get("findings", []):
    st.write(f"- {finding}")

# Recommendations
st.header("Optimization Recommendations")
for rec in report.get("recommendations", []):
    savings_str = (
        f"${rec['estimated_monthly_savings']:,.2f}"
        if rec.get("estimated_monthly_savings") is not None
        else "Not calculable"
    )
    st.markdown(
        f"**[{rec['classification']}] {rec['resource_id']}** — {rec['reason']}  \n"
        f"*Suggested Action:* {rec['suggested_action']} · *Est. Savings:* {savings_str}"
    )

if st.button("Back to Home Page"):
    st.switch_page("app.py")
