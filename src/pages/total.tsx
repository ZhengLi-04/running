import { Helmet } from 'react-helmet-async';
import { useMemo, useState, lazy, Suspense } from 'react';
import { useTheme } from '@/hooks/useTheme';
import Layout from '@/components/Layout';
import ActivityList from '@/components/ActivityList';
import useSiteMetadata from '@/hooks/useSiteMetadata';
import useActivities from '@/hooks/useActivities';
import RoutePreview from '@/components/RoutePreview';
import { githubYearStats } from '@assets/index';
import { loadSvgComponent } from '@/utils/svgUtils';
import {
  DIST_UNIT,
  M_TO_DIST,
  convertMovingTime2Sec,
  formatPace,
  locationForRun,
} from '@/utils/utils';
import { Activity } from '@/utils/utils';

const SummaryPage = () => {
  const { theme } = useTheme();
  const { siteTitle } = useSiteMetadata();
  const { activities, years, cities } = useActivities();
  const [selectedYear, setSelectedYear] = useState(years[0] || '');
  const [reportInterval, setReportInterval] = useState<
    'year' | 'month' | 'week' | 'day'
  >('month');
  const [topRunsCount, setTopRunsCount] = useState(5);

  const topLocations = useMemo(() => {
    const map = new Map<string, number>();
    activities.forEach((run) => {
      const { city, province, country } = locationForRun(run);
      const location =
        city || province || country || run.location_country || 'Unknown';
      map.set(location, (map.get(location) || 0) + run.distance);
    });
    const list = Array.from(map.entries());
    list.sort((a, b) => b[1] - a[1]);
    return list.slice(0, 6);
  }, [activities]);

  const topRuns = useMemo(() => {
    return activities
      .slice()
      .sort((a, b) => b.distance - a.distance)
      .slice(0, topRunsCount);
  }, [activities, topRunsCount]);

  const latestRuns = useMemo(() => {
    return activities
      .slice()
      .sort(
        (a, b) =>
          new Date(b.start_date_local).getTime() -
          new Date(a.start_date_local).getTime()
      )
      .slice(0, 30);
  }, [activities]);

  const YearSvg = useMemo(() => {
    if (!selectedYear) return null;
    return lazy(() =>
      loadSvgComponent(githubYearStats, `./github_${selectedYear}.svg`)
    );
  }, [selectedYear]);

  const yearRuns = useMemo(() => {
    if (!selectedYear) return activities;
    return activities.filter(
      (run) => run.start_date_local.slice(0, 4) === selectedYear
    );
  }, [activities, selectedYear]);

  const yearStats = useMemo(() => {
    const totalDistance = yearRuns.reduce((acc, run) => acc + run.distance, 0);
    const totalSeconds = yearRuns.reduce(
      (acc, run) => acc + convertMovingTime2Sec(run.moving_time),
      0
    );
    const avgSpeed = totalSeconds > 0 ? totalDistance / totalSeconds : 0;
    const longest = yearRuns.reduce(
      (max, run) => Math.max(max, run.distance),
      0
    );
    const dates = Array.from(
      new Set(yearRuns.map((run) => run.start_date_local.slice(0, 10)))
    )
      .map((d) => new Date(d).getTime())
      .sort((a, b) => a - b);
    let streak = 0;
    let current = 0;
    for (let i = 0; i < dates.length; i++) {
      if (i === 0 || dates[i] - dates[i - 1] === 86400000) {
        current += 1;
      } else {
        current = 1;
      }
      streak = Math.max(streak, current);
    }
    return {
      runs: yearRuns.length,
      distance: `${(totalDistance / M_TO_DIST).toFixed(1)} ${DIST_UNIT}`,
      time:
        totalSeconds > 0
          ? `${Math.floor(totalSeconds / 3600)}h ${Math.floor(
              (totalSeconds % 3600) / 60
            )}m`
          : '0m',
      pace: avgSpeed > 0 ? formatPace(avgSpeed) : '—',
      longest: `${(longest / M_TO_DIST).toFixed(1)} ${DIST_UNIT}`,
      streak,
    };
  }, [yearRuns]);

  const totalDistance = useMemo(() => {
    const sum = activities.reduce((acc, run) => acc + run.distance, 0);
    return `${(sum / M_TO_DIST).toFixed(1)} ${DIST_UNIT}`;
  }, [activities]);

  const totalDuration = useMemo(() => {
    const seconds = activities.reduce(
      (acc, run) => acc + convertMovingTime2Sec(run.moving_time),
      0
    );
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }, [activities]);

  const totalCities = useMemo(() => {
    return new Set(
      activities
        .map((run) => {
          const { city, province, country } = locationForRun(run);
          return city || province || country || run.location_country || '';
        })
        .filter((x) => x.length > 0)
    ).size;
  }, [activities]);

  return (
    <Layout>
      <Helmet>
        <html lang="en" data-theme={theme} />
      </Helmet>
      <div className="dashboard summary-page">
        <section className="card summary-hero">
          <div className="card-body">
            <p className="eyebrow">Summary</p>
            <h1 className="hero-title">{siteTitle} Reports</h1>
            <p className="hero-subtitle">
              年度、月度、地点与线路的完整报告，集中在一个页面里。
            </p>
            <div className="hero-meta">
              <span className="pill">{activities.length} Activities</span>
              <span className="pill">Total Distance: {totalDistance}</span>
              <span className="pill">Total Time: {totalDuration}</span>
              <span className="pill">Total Cities: {totalCities}</span>
            </div>
          </div>
        </section>

        <div className="summary-grid">
          <section className="card summary-year summary-year--full">
            <div className="card-header">
              <h2 className="card-title">Year Highlights</h2>
              <p className="card-subtitle">切换年份查看年度摘要</p>
            </div>
            <div className="card-body">
              <div className="summary-year-tabs">
                {years.map((y) => (
                  <button
                    key={y}
                    className={`filter-pill ${
                      selectedYear === y ? 'filter-pill-active' : ''
                    }`}
                    type="button"
                    onClick={() => setSelectedYear(y)}
                  >
                    {y}
                  </button>
                ))}
              </div>
              {YearSvg && (
                <div className="summary-year-svg">
                  <Suspense fallback={<div>Loading...</div>}>
                    <YearSvg className="year-svg w-full" />
                  </Suspense>
                </div>
              )}
              <div className="summary-year-stats">
                <span className="pill">Runs: {yearStats.runs}</span>
                <span className="pill">Distance: {yearStats.distance}</span>
                <span className="pill">Time: {yearStats.time}</span>
                <span className="pill">Avg Pace: {yearStats.pace}</span>
                <span className="pill">Longest: {yearStats.longest}</span>
                <span className="pill">Streak: {yearStats.streak} days</span>
              </div>
            </div>
          </section>

          <section className="card summary-location">
            <div className="card-header">
              <h2 className="card-title">Locations</h2>
              <p className="card-subtitle">精确到区/街道（若可解析）</p>
            </div>
            <div className="card-body">
              <ul className="summary-list">
                {topLocations.map(([location, distance]) => (
                  <li key={location} className="summary-list-item">
                    <span>{location}</span>
                    <span>
                      {(distance / M_TO_DIST).toFixed(1)} {DIST_UNIT}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="card summary-routes">
            <div className="card-header">
              <div className="card-header-row">
                <h2 className="card-title">Routes</h2>
                <div className="summary-select">
                  <label>
                    Top
                    <select
                      value={topRunsCount}
                      onChange={(e) => setTopRunsCount(Number(e.target.value))}
                    >
                      {[3, 5, 8, 10].map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <p className="card-subtitle">最长的几次跑步记录</p>
            </div>
            <div className="card-body">
              <div className="summary-list">
                {topRuns.map((run) => (
                  <div key={run.run_id} className="summary-list-item">
                    <span>{run.name || 'Run'}</span>
                    <span>
                      {(run.distance / M_TO_DIST).toFixed(2)} {DIST_UNIT}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <section className="card summary-reports">
          <div className="card-header">
            <div className="card-header-row">
              <div>
                <h2 className="card-title">Report Builder</h2>
                <p className="card-subtitle">
                  按年度、月度、周或单日生成统计卡片
                </p>
              </div>
              <div className="summary-tabs">
                {(['year', 'month', 'week', 'day'] as const).map(
                  (interval) => (
                    <button
                      key={interval}
                      className={`filter-pill ${
                        reportInterval === interval
                          ? 'filter-pill-active'
                          : ''
                      }`}
                      onClick={() => setReportInterval(interval)}
                    >
                      {interval}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
          <div className="card-body">
            <ActivityList
              interval={reportInterval}
              onIntervalChange={setReportInterval}
              hideControls
              useContentHeight
            />
          </div>
        </section>

        <section className="card summary-route-grid">
          <div className="card-header">
            <h2 className="card-title">Route Grid</h2>
            <div className="card-header-row">
              <p className="card-subtitle">最新记录优先，8 列排布</p>
              <div className="route-grid-legend">
                <span className="legend-item legend-5">≥5km</span>
                <span className="legend-item legend-10">≥10km</span>
              </div>
            </div>
          </div>
          <div className="card-body">
            <div className="route-grid">
              {latestRuns.map((run) => (
                <div
                  key={run.run_id}
                  className={`route-grid-item ${
                    run.distance / M_TO_DIST >= 10
                      ? 'route-grid-item--10'
                      : run.distance / M_TO_DIST >= 5
                        ? 'route-grid-item--5'
                        : ''
                  }`}
                >
                  <RoutePreview activities={[run] as Activity[]} width={150} height={90} />
                  <div className="route-grid-meta">
                    <span>{run.start_date_local.slice(5, 10)}</span>
                    <span>
                      {(run.distance / M_TO_DIST).toFixed(1)} {DIST_UNIT}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default SummaryPage;
