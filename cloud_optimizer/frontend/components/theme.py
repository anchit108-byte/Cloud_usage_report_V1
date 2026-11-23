import streamlit as st


def init_theme_state() -> None:
    if "theme_mode" not in st.session_state:
        st.session_state.theme_mode = "light"


def render_theme_toggle() -> None:
    init_theme_state()
    current = st.session_state.theme_mode
    label = "Switch to Dark Mode" if current == "light" else "Switch to Light Mode"
    if st.button(label, key="theme_toggle_btn"):
        st.session_state.theme_mode = "dark" if current == "light" else "light"
        st.rerun()


def apply_theme_css() -> None:
    init_theme_state()
    is_dark = st.session_state.theme_mode == "dark"

    bg = "#0F172A" if is_dark else "#FFFFFF"
    card_bg = "#1E293B" if is_dark else "#F8FAFC"
    text_primary = "#F8FAFC" if is_dark else "#0F172A"
    text_muted = "#94A3B8" if is_dark else "#475569"
    border = "#334155" if is_dark else "#E2E8F0"
    accent = "#2563EB"

    st.markdown(
        f"""
        <style>
        .stApp {{
            background-color: {bg};
            color: {text_primary};
            transition: background-color 0.3s ease, color 0.3s ease;
        }}
        .cloud-card {{
            background-color: {card_bg};
            border: 1px solid {border};
            border-radius: 12px;
            padding: 1.25rem;
            margin-bottom: 1rem;
            transition: background-color 0.3s ease, border-color 0.3s ease;
        }}
        .cloud-muted {{
            color: {text_muted};
        }}
        .stButton > button {{
            border-radius: 8px;
            border: 1px solid {accent};
            transition: all 0.2s ease;
        }}
        @keyframes successBlink3s {{
            0%, 100% {{ opacity: 1; }}
            16.6%, 50%, 83.3% {{ opacity: 0.25; }}
            33.3%, 66.6% {{ opacity: 1; }}
        }}
        .blink-success-3s {{
            background-color: #ECFDF5;
            border: 1px solid #10B981;
            color: #065F46;
            padding: 0.9rem 1.1rem;
            border-radius: 10px;
            font-weight: 600;
            animation: successBlink3s 3s ease-in-out 1 forwards;
        }}
        </style>
        """,
        unsafe_allow_html=True,
    )
