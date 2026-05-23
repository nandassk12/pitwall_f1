import matplotlib
matplotlib.use('Agg')  # Non-GUI backend, required for server use
import matplotlib.pyplot as plt
import seaborn as sns
import io, base64

def fig_to_base64(fig):
    buf = io.BytesIO()
    fig.savefig(buf, format='png', bbox_inches='tight',
                facecolor='#09090d', transparent=False)
    buf.seek(0)
    encoded = base64.b64encode(buf.read()).decode('utf-8')
    plt.close(fig)
    return encoded

@app.get("/api/chart/speed")
def chart_speed(driver: str = "VER"):
    stream = DRIVERS_ENGINEERING_CACHE.get(driver, [])
    if not stream:
        return {"error": "no data"}

    speeds    = [p["speed"]    for p in stream]
    ref_speeds = [p["refSpeed"] for p in stream]
    x = list(range(len(speeds)))

    fig, ax = plt.subplots(figsize=(9, 3))
    fig.patch.set_facecolor('#09090d')
    ax.set_facecolor('#09090d')

    ax.fill_between(x, speeds, alpha=0.25, color='#e10600')
    ax.plot(x, speeds,     color='#e10600', linewidth=2,   label=f'{driver} Speed')
    ax.plot(x, ref_speeds, color='#4b5563', linewidth=1,
            linestyle='--', label='Pole Reference')

    ax.set_ylim(60, 310)
    ax.tick_params(colors='#444552')
    ax.spines[:].set_color('#14141f')
    ax.legend(facecolor='#09090d', labelcolor='white', fontsize=8)
    plt.tight_layout()
    return {"image": fig_to_base64(fig)}


@app.get("/api/chart/throttle")
def chart_throttle(driver: str = "VER"):
    stream = DRIVERS_ENGINEERING_CACHE.get(driver, [])
    if not stream:
        return {"error": "no data"}

    df = pd.DataFrame(stream)[["time", "throttle", "brake"]]

    fig, ax = plt.subplots(figsize=(9, 2.5))
    fig.patch.set_facecolor('#09090d')
    ax.set_facecolor('#09090d')

    # seaborn lineplot
    sns.lineplot(data=df, x="time", y="throttle",
                 color="#00e676", linewidth=1.5, ax=ax, label="Throttle %")
    sns.lineplot(data=df, x="time", y="brake",
                 color="#ff1744", linewidth=1.5, ax=ax, label="Brake %")

    ax.set_ylim(0, 100)
    ax.tick_params(colors='#444552')
    ax.spines[:].set_color('#14141f')
    ax.legend(facecolor='#09090d', labelcolor='white', fontsize=8)
    plt.tight_layout()
    return {"image": fig_to_base64(fig)}


@app.get("/api/chart/tyres")
def chart_tyres(driver: str = "VER"):
    stream = DRIVERS_ENGINEERING_CACHE.get(driver, [])
    if not stream:
        return {"error": "no data"}

    df = pd.DataFrame(stream)[["time", "tyreWearPercent"]]

    fig, ax = plt.subplots(figsize=(9, 2))
    fig.patch.set_facecolor('#09090d')
    ax.set_facecolor('#09090d')

    # seaborn — colour shifts with wear level
    sns.lineplot(data=df, x="time", y="tyreWearPercent",
                 color="#ffea00", linewidth=2, ax=ax)
    ax.fill_between(df["time"], df["tyreWearPercent"], alpha=0.2, color="#ffea00")
    ax.set_ylim(0, 100)
    ax.tick_params(colors='#444552')
    ax.spines[:].set_color('#14141f')
    plt.tight_layout()
    return {"image": fig_to_base64(fig)}
