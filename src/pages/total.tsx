import { Helmet } from 'react-helmet-async';
import { useMemo, useState, lazy, Suspense } from 'react';
import { useTheme } from '@/hooks/useTheme';
import Layout from '@/components/Layout';
import ActivityList from '@/components/ActivityList';
import useSiteMetadata from '@/hooks/useSiteMetadata';
import useActivities from '@/hooks/useActivities';
import RoutePreview from '@/components/RoutePreview';
import { yearSummaryStats } from '@assets/index';
import { loadSvgComponent } from '@/utils/svgUtils';
import {
  DIST_UNIT,
  M_TO_DIST,
  convertMovingTime2Sec,
  locationForRun,
} from '@/utils/utils';
import { Activity } from '@/utils/utils';

const SummaryPage = () => {
  const { theme } = useTheme();
  const { siteTitle } = useSiteMetadata();
  const { activities, years, cities } = useActivities();
  const [selectedYear, setSelectedYear] = useState(years[0] || '');
  const [reportInterval, setReportInterval] = useState<
    'year' | 'month' | 'week' | 'day' | 'life'
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
      loadSvgComponent(yearSummaryStats, `./year_summary_${selectedYear}.svg`)
    );
  }, [selectedYear]);

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
        .map((run) => run.location_country || '')
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
          <section className="card summary-year">
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
                {(['year', 'month', 'week', 'day', 'life'] as const).map(
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
            />
          </div>
        </section>

        <section className="card summary-route-grid">
          <div className="card-header">
            <h2 className="card-title">Route Grid</h2>
            <p className="card-subtitle">最新记录优先，8 列排布</p>
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
