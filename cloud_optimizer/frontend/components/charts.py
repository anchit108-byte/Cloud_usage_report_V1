from typing import Any, Dict, List

import matplotlib.pyplot as plt
import numpy as np
import streamlit as st


def render_usage_vs_cost_chart(usage_vs_cost: Dict[str, Any], is_dark: bool) -> None:
    st.subheader("Graph 1: Usage vs Cost (Grouped Bar Chart)")
    if not usage_vs_cost.get("available") or not usage_vs_cost.get("data"):
        st.info(usage_vs_cost.get("reason", "Usage vs Cost metrics are unavailable."))
        return

    points = usage_vs_cost["data"]
    labels = [p["label"] for p in points]
    usages = [p["usage"] for p in points]
    costs = [p["cost"] for p in points]

    fig, ax1 = plt.subplots(figsize=(9, 4.2))
    bg = "#0F172A" if is_dark else "#FFFFFF"
    fg = "#F8FAFC" if is_dark else "#0F172A"
    fig.patch.set_facecolor(bg)
    ax1.set_facecolor(bg)

    x = np.arange(len(labels))
    width = 0.36

    ax1.bar(x - width / 2, usages, width, label=usage_vs_cost.get("usage_unit", "Usage"), color="#2563EB")
    ax1.set_ylabel(usage_vs_cost.get("usage_unit", "Usage"), color="#2563EB")
    ax1.tick_params(axis="y", labelcolor="#2563EB")
    ax1.set_xticks(x)
    ax1.set_xticklabels(labels, rotation=25, ha="right", color=fg)

    ax2 = ax1.twinx()
    ax2.bar(x + width / 2, costs, width, label="Cost (USD)", color="#38BDF8")
    ax2.set_ylabel("Cost (USD)", color="#0284C7")
    ax2.tick_params(axis="y", labelcolor="#0284C7")

    ax1.set_title(f"Usage vs Cost by {usage_vs_cost.get('group_by_label', 'Service')}", color=fg)
    fig.tight_layout()
    st.pyplot(fig)
    plt.close(fig)


def render_year_over_year_chart(yoy: Dict[str, Any], is_dark: bool) -> None:
    st.subheader("Graph 2: Current Year vs Previous Year (Monthly Cost)")
    if not yoy.get("available") or not yoy.get("data"):
        st.info(yoy.get("reason", "Multi-year monthly comparison unavailable."))
        return

    points = yoy["data"]
    months = [p["month_label"] for p in points]
    prev_vals = [p["previous_year_cost"] or 0.0 for p in points]
    curr_vals = [p["current_year_cost"] or 0.0 for p in points]

    fig, ax = plt.subplots(figsize=(9, 4.2))
    bg = "#0F172A" if is_dark else "#FFFFFF"
    fg = "#F8FAFC" if is_dark else "#0F172A"
    fig.patch.set_facecolor(bg)
    ax.set_facecolor(bg)

    x = np.arange(len(months))
    width = 0.38
    ax.bar(x - width / 2, prev_vals, width, label=str(yoy["previous_year"]), color="#94A3B8")
    ax.bar(x + width / 2, curr_vals, width, label=str(yoy["current_year"]), color="#2563EB")

    ax.set_xticks(x)
    ax.set_xticklabels(months, color=fg)
    ax.set_ylabel("Monthly Cost (USD)", color=fg)
    ax.tick_params(axis="y", labelcolor=fg)
    ax.set_title(f"{yoy['current_year']} vs {yoy['previous_year']} Monthly Cost", color=fg)
    ax.legend()
    fig.tight_layout()
    st.pyplot(fig)
    plt.close(fig)


def render_breakdown_chart(title: str, items: List[Dict[str, Any]], empty_msg: str, is_dark: bool) -> None:
    st.subheader(title)
    if not items:
        st.info(empty_msg)
        return

    labels = [i["label"] for i in items][::-1]
    values = [i["value"] for i in items][::-1]

    fig, ax = plt.subplots(figsize=(8, max(3.0, len(labels) * 0.42)))
    bg = "#0F172A" if is_dark else "#FFFFFF"
    fg = "#F8FAFC" if is_dark else "#0F172A"
    fig.patch.set_facecolor(bg)
    ax.set_facecolor(bg)

    ax.barh(labels, values, color="#2563EB")
    ax.set_xlabel("Cost (USD)", color=fg)
    ax.tick_params(colors=fg)
    fig.tight_layout()
    st.pyplot(fig)
    plt.close(fig)
