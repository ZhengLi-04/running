import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { Helmet } from 'react-helmet-async';
import Layout from '@/components/Layout';
import RunMap from '@/components/RunMap';
import useActivities from '@/hooks/useActivities';
import useSiteMetadata from '@/hooks/useSiteMetadata';
import { useInterval } from '@/hooks/useInterval';
import {
  Activity,
  IViewState,
  DIST_UNIT,
  M_TO_DIST,
  convertMovingTime2Sec,
  formatPace,
  formatRunTime,
  locationForRun,
  filterAndSortRuns,
  filterCityRuns,
  filterYearRuns,
  geoJsonForRuns,
  getBoundsForGeoData,
  scrollToMap,
  sortDateFunc,
  titleForShow,
  RunIds,
} from '@/utils/utils';
import { useTheme, useThemeChangeCounter } from '@/hooks/useTheme';

const Index = () => {
  const { siteTitle, siteUrl } = useSiteMetadata();
  const { activities, thisYear, years, cities } = useActivities();
  const themeChangeCounter = useThemeChangeCounter();
  const [year, setYear] = useState(thisYear);
  const [runIndex, setRunIndex] = useState(-1);
  const [title, setTitle] = useState('');
  // Animation states for replacing intervalIdRef
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentAnimationIndex, setCurrentAnimationIndex] = useState(0);
  const [animationRuns, setAnimationRuns] = useState<Activity[]>([]);
  const [currentFilter, setCurrentFilter] = useState<{
    item: string;
    func: (_run: Activity, _value: string) => boolean;
  }>({ item: thisYear, func: filterYearRuns });

  // State to track if we're showing a single run from URL hash
  const [singleRunId, setSingleRunId] = useState<number | null>(null);

  // Animation trigger for single runs - increment this to force animation replay
  const [animationTrigger, setAnimationTrigger] = useState(0);

  const selectedRunIdRef = useRef<number | null>(null);
  const selectedRunDateRef = useRef<string | null>(null);

  // Parse URL hash on mount to check for run ID
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && hash.startsWith('run_')) {
      const runId = parseInt(hash.replace('run_', ''), 10);
      if (!isNaN(runId)) {
        setSingleRunId(runId);
      }
    }

    // Listen for hash changes (browser back/forward buttons)
    const handleHashChange = () => {
      const newHash = window.location.hash.replace('#', '');
      if (newHash && newHash.startsWith('run_')) {
        const runId = parseInt(newHash.replace('run_', ''), 10);
        if (!isNaN(runId)) {
          setSingleRunId(runId);
        }
      } else {
        // Hash was cleared, reset to normal view
        setSingleRunId(null);
      }
    };

    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // Memoize expensive calculations
  const runs = useMemo(() => {
    return filterAndSortRuns(
      activities,
      currentFilter.item,
      currentFilter.func,
      sortDateFunc
    );
  }, [activities, currentFilter.item, currentFilter.func]);

  const geoData = useMemo(() => {
    return geoJsonForRuns(runs);
  }, [runs, themeChangeCounter]);

  // for auto zoom
  const bounds = useMemo(() => {
    return getBoundsForGeoData(geoData);
  }, [geoData]);

  const [viewState, setViewState] = useState<IViewState>(() => ({
    ...bounds,
  }));

  // Add state for animated geoData to handle the animation effect
  const [animatedGeoData, setAnimatedGeoData] = useState(geoData);

  // Use useInterval for animation instead of intervalIdRef
  useInterval(
    () => {
      if (!isAnimating || currentAnimationIndex >= animationRuns.length) {
        setIsAnimating(false);
        setAnimatedGeoData(geoData);
        return;
      }

      const runsNum = animationRuns.length;
      const sliceNum = runsNum >= 8 ? Math.ceil(runsNum / 8) : 1;
      const nextIndex = Math.min(currentAnimationIndex + sliceNum, runsNum);
      const tempRuns = animationRuns.slice(0, nextIndex);
      setAnimatedGeoData(geoJsonForRuns(tempRuns));
      setCurrentAnimationIndex(nextIndex);

      if (nextIndex >= runsNum) {
        setIsAnimating(false);
        setAnimatedGeoData(geoData);
      }
    },
    isAnimating ? 300 : null
  );

  // Helper function to start animation
  const startAnimation = useCallback(
    (runsToAnimate: Activity[]) => {
      if (runsToAnimate.length === 0) {
        setAnimatedGeoData(geoData);
        return;
      }

      const sliceNum =
        runsToAnimate.length >= 8 ? Math.ceil(runsToAnimate.length / 8) : 1;
      setAnimationRuns(runsToAnimate);
      setCurrentAnimationIndex(sliceNum);
      setIsAnimating(true);
    },
    [geoData]
  );

  const changeByItem = useCallback(
    (
      item: string,
      name: string,
      func: (_run: Activity, _value: string) => boolean
    ) => {
      scrollToMap();
      if (name !== 'Year') {
        setYear(thisYear);
      }
      setCurrentFilter({ item, func });
      setRunIndex(-1);
      setTitle(`${item} ${name} Running Heatmap`);
      // Reset single run state when changing filters
      setSingleRunId(null);
      if (window.location.hash) {
        window.history.pushState(null, '', window.location.pathname);
      }
    },
    [thisYear]
  );

  const changeYear = useCallback(
    (y: string) => {
      // default year
      setYear(y);

      if ((viewState.zoom ?? 0) > 3 && bounds) {
        setViewState({
          ...bounds,
        });
      }

      changeByItem(y, 'Year', filterYearRuns);
      // Stop current animation
      setIsAnimating(false);
    },
    [viewState.zoom, bounds, changeByItem]
  );

  const changeCity = useCallback(
    (city: string) => {
      changeByItem(city, 'City', filterCityRuns);
    },
    [changeByItem]
  );

  const locateActivity = useCallback(
    (runIds: RunIds) => {
      const ids = new Set(runIds);

      const selectedRuns = !runIds.length
        ? runs
        : runs.filter((r: any) => ids.has(r.run_id));

      if (!selectedRuns.length) {
        return;
      }

      const lastRun = selectedRuns.sort(sortDateFunc)[0];

      if (!lastRun) {
        return;
      }

      // Set runIndex for table highlighting when single run is selected
      if (runIds.length === 1) {
        const runId = runIds[0];
        const runIdx = runs.findIndex((run) => run.run_id === runId);
        setRunIndex(runIdx);
      } else {
        setRunIndex(-1);
      }

      // Update URL hash when a single run is located
      if (runIds.length === 1) {
        const runId = runIds[0];
        const newHash = `#run_${runId}`;
        if (window.location.hash !== newHash) {
          window.history.pushState(null, '', newHash);
        }
        setSingleRunId(runId);
      } else {
        // If multiple runs or no runs, clear the hash and single run state
        if (window.location.hash) {
          window.history.pushState(null, '', window.location.pathname);
        }
        setSingleRunId(null);
      }

      // Create geoData for selected runs and calculate new bounds
      const selectedGeoData = geoJsonForRuns(selectedRuns);
      const selectedBounds = getBoundsForGeoData(selectedGeoData);

      // Stop any existing animation
      setIsAnimating(false);

      // Update the animated geoData immediately to trigger RunMap animation
      setAnimatedGeoData(selectedGeoData);

      // For single run, trigger animation by incrementing the trigger
      if (runIds.length === 1) {
        setAnimationTrigger((prev) => prev + 1);
      }

      // Update view state
      setViewState({
        ...selectedBounds,
      });
      setTitle(titleForShow(lastRun));
      scrollToMap();
    },
    [runs]
  );

  // Auto locate activity when singleRunId is set and activities are loaded
  // First, detect the run's year and switch to it if needed
  useEffect(() => {
    if (singleRunId !== null && activities.length > 0) {
      const targetRun = activities.find((run) => run.run_id === singleRunId);
      if (targetRun) {
        const runYear = targetRun.start_date_local.slice(0, 4);
        if (year !== runYear) {
          setYear(runYear);
          setCurrentFilter({ item: runYear, func: filterYearRuns });
        }
      } else {
        // If run doesn't exist, clear the hash and show a warning
        console.warn(`Run with ID ${singleRunId} not found in activities`);
        window.history.replaceState(null, '', window.location.pathname);
        setSingleRunId(null);
      }
    }
  }, [singleRunId, activities]);

  useEffect(() => {
    if (singleRunId !== null && runs.length > 0) {
      const runExistsInCurrentRuns = runs.some(
        (run) => run.run_id === singleRunId
      );
      if (runExistsInCurrentRuns) {
        locateActivity([singleRunId]);
      }
    }
  }, [runs, singleRunId, locateActivity]);

  // Update bounds when geoData changes
  useEffect(() => {
    if (singleRunId === null) {
      setViewState((prev) => ({
        ...prev,
        ...bounds,
      }));
    }
  }, [bounds, singleRunId]);

  // Animate geoData when runs change
  useEffect(() => {
    if (singleRunId === null) {
      startAnimation(runs);
    }
  }, [runs, startAnimation, singleRunId]);

  useEffect(() => {
    if (year !== 'Total') {
      return;
    }

    let svgStat = document.getElementById('svgStat');
    if (!svgStat) {
      return;
    }

    const handleClick = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName.toLowerCase() === 'path') {
        // Use querySelector to get the <desc> element and the <title> element.
        const descEl = target.querySelector('desc');
        if (descEl) {
          // If the runId exists in the <desc> element, it means that a running route has been clicked.
          const runId = Number(descEl.innerHTML);
          if (!runId) {
            return;
          }
          if (selectedRunIdRef.current === runId) {
            selectedRunIdRef.current = null;
            locateActivity(runs.map((r) => r.run_id));
          } else {
            selectedRunIdRef.current = runId;
            locateActivity([runId]);
          }
          return;
        }

        const titleEl = target.querySelector('title');
        if (titleEl) {
          // If the runDate exists in the <title> element, it means that a date square has been clicked.
          const [runDate] = titleEl.innerHTML.match(
            /\d{4}-\d{1,2}-\d{1,2}/
          ) || [`${+thisYear + 1}`];
          const runIDsOnDate = runs
            .filter((r) => r.start_date_local.slice(0, 10) === runDate)
            .map((r) => r.run_id);
          if (!runIDsOnDate.length) {
            return;
          }
          if (selectedRunDateRef.current === runDate) {
            selectedRunDateRef.current = null;
            locateActivity(runs.map((r) => r.run_id));
          } else {
            selectedRunDateRef.current = runDate;
            locateActivity(runIDsOnDate);
          }
        }
      }
    };
    svgStat.addEventListener('click', handleClick);
    return () => {
      svgStat && svgStat.removeEventListener('click', handleClick);
    };
  }, [year]);

  const { theme } = useTheme();

  const yearsWithTotal = useMemo(() => {
    const list = years.slice();
    list.unshift(thisYear);
    const unique = Array.from(new Set(list));
    if (!unique.includes('Total')) unique.push('Total');
    return unique;
  }, [years, thisYear]);

  const topCities = useMemo(() => {
    const list = Object.entries(cities);
    list.sort((a, b) => b[1] - a[1]);
    return list.slice(0, 6);
  }, [cities]);

  const stats = useMemo(() => {
    const totalRuns = runs.length;
    const totalDistance = runs.reduce((sum, run) => sum + run.distance, 0);
    const totalSeconds = runs.reduce(
      (sum, run) => sum + convertMovingTime2Sec(run.moving_time),
      0
    );
    const avgSpeed = totalSeconds > 0 ? totalDistance / totalSeconds : 0;
    const avgPace = avgSpeed > 0 ? formatPace(avgSpeed) : '—';
    const totalDistanceLabel = `${(totalDistance / M_TO_DIST).toFixed(2)} ${DIST_UNIT}`;
    const totalDurationLabel = (() => {
      if (totalSeconds <= 0) return '0m';
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    })();
    const avgHeartRate = (() => {
      const values = runs
        .map((run) => run.average_heartrate)
        .filter((v): v is number => typeof v === 'number');
      if (!values.length) return null;
      return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    })();
    const totalElevation = runs.reduce(
      (sum, run) => sum + (run.elevation_gain ?? 0),
      0
    );
    const longestRun = runs.reduce(
      (max, run) => Math.max(max, run.distance),
      0
    );
    return {
      totalRuns,
      totalDistanceLabel,
      totalDurationLabel,
      avgPace,
      avgHeartRate,
      totalElevationLabel: `${(totalElevation / M_TO_DIST).toFixed(0)} ${DIST_UNIT}`,
      longestRunLabel: `${(longestRun / M_TO_DIST).toFixed(2)} ${DIST_UNIT}`,
    };
  }, [runs]);

  const heartRateSeries = useMemo(() => {
    const values = runs
      .filter((run) => typeof run.average_heartrate === 'number')
      .slice(0, 20)
      .map((run) => run.average_heartrate as number)
      .reverse();
    if (!values.length) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const width = 160;
    const height = 48;
    return values
      .map((value, idx) => {
        const x = (idx / Math.max(values.length - 1, 1)) * width;
        const y =
          height - ((value - min) / Math.max(max - min, 1)) * height + 2;
        return `${x},${y}`;
      })
      .join(' ');
  }, [runs]);

  return (
    <Layout>
      <Helmet>
        <html lang="en" data-theme={theme} />
      </Helmet>
      <div className="dashboard">
        <section className="card dashboard-hero">
          <div className="card-body">
            <p className="eyebrow">Running Dashboard</p>
            <h1 className="hero-title">
              <a href={siteUrl}>{siteTitle}</a>
            </h1>
            <p className="hero-subtitle">
              简洁、模块化的跑步记录面板，自动同步并持续更新。
            </p>
            <div className="hero-meta">
              <span className="pill">View: {year}</span>
              <span className="pill">{runs.length} Runs</span>
              <span className="pill">Current Year: {thisYear}</span>
            </div>
          </div>
        </section>

        <section className="card filter-bar">
          <div className="filter-section">
            <span className="filter-label">Years</span>
            <div className="filter-options">
              {yearsWithTotal.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => changeYear(item)}
                  className={`filter-pill ${
                    currentFilter.func === filterYearRuns &&
                    currentFilter.item === item
                      ? 'filter-pill-active'
                      : ''
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-section">
            <span className="filter-label">Cities</span>
            <div className="filter-options">
              <button
                type="button"
                onClick={() => changeYear(thisYear)}
                className={`filter-pill ${
                  currentFilter.func === filterYearRuns &&
                  currentFilter.item === thisYear
                    ? 'filter-pill-active'
                    : ''
                }`}
              >
                All
              </button>
              {topCities.map(([city]) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => changeCity(city)}
                  className={`filter-pill ${
                    currentFilter.func === filterCityRuns &&
                    currentFilter.item === city
                      ? 'filter-pill-active'
                      : ''
                  }`}
                >
                  {city}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-section filter-link">
            <a href={`${siteUrl}/summary`} className="filter-summary-link">
              查看年度总结与热力图 →
            </a>
          </div>
        </section>

        <div className="dashboard-grid dashboard-grid--main">
          <section className="card run-list-card">
            <div className="card-header">
              <h2 className="card-title">Run List</h2>
              <p className="card-subtitle">当前筛选结果</p>
            </div>
            <div className="card-body">
              <ul className="run-list">
                {runs.map((run) => (
                  <li
                    key={run.run_id}
                    className={`run-item ${
                      runIndex >= 0 && runs[runIndex]?.run_id === run.run_id
                        ? 'run-item-active'
                        : ''
                    }`}
                    onClick={() => locateActivity([run.run_id])}
                  >
                    {(() => {
                      const { city, province, country } = locationForRun(run);
                      const location =
                        city || province || country || 'Unknown';
                      return (
                        <>
                          <div className="run-item-location">{location}</div>
                          <div className="run-item-header">
                            <span className="run-item-title">
                              {run.name || 'Run'}
                            </span>
                            <span className="run-item-date">
                              {run.start_date_local.slice(0, 10)}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                    <div className="run-item-meta">
                      <span>
                        {(run.distance / M_TO_DIST).toFixed(2)} {DIST_UNIT}
                      </span>
                      <span>{formatPace(run.average_speed)}</span>
                      <span>{formatRunTime(run.moving_time)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <div className="dashboard-main">
            <section className="card map-card" id="map-container">
              <div className="card-header">
                <h2 className="card-title">
                  {title || `${year} Running Map`}
                </h2>
                <p className="card-subtitle">地图与路线概览</p>
              </div>
              <div className="card-body">
                <RunMap
                  title={title}
                  viewState={viewState}
                  geoData={animatedGeoData}
                  setViewState={setViewState}
                  changeYear={changeYear}
                  thisYear={year}
                  animationTrigger={animationTrigger}
                />
              </div>
            </section>

            <section className="card stats-card">
              <div className="card-header">
                <h2 className="card-title">Key Metrics</h2>
                <p className="card-subtitle">自动汇总当前筛选结果</p>
              </div>
              <div className="card-body">
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">Total Distance</span>
                    <span className="stat-value">{stats.totalDistanceLabel}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Total Time</span>
                    <span className="stat-value">{stats.totalDurationLabel}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Avg Pace</span>
                    <span className="stat-value">{stats.avgPace}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Avg HR</span>
                    <span className="stat-value">
                      {stats.avgHeartRate ? `${stats.avgHeartRate} bpm` : '—'}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Elevation</span>
                    <span className="stat-value">
                      {stats.totalElevationLabel}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Longest Run</span>
                    <span className="stat-value">{stats.longestRunLabel}</span>
                  </div>
                </div>
                <div className="sparkline">
                  <div className="sparkline-title">Heart Rate Trend</div>
                  {heartRateSeries ? (
                    <svg viewBox="0 0 160 52" role="img">
                      <polyline
                        points={heartRateSeries}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                  ) : (
                    <div className="sparkline-empty">No heart rate data</div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
      {/* Enable Audiences in Vercel Analytics: https://vercel.com/docs/concepts/analytics/audiences/quickstart */}
      {import.meta.env.VERCEL && <Analytics />}
    </Layout>
  );
};

export default Index;
