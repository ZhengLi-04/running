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
import { DIST_UNIT, M_TO_DIST, convertMovingTime2Sec } from '@/utils/utils';
import { Activity } from '@/utils/utils';

const SummaryPage = () => {
  const { theme } = useTheme();
  const { siteTitle } = useSiteMetadata();
  const { activities, years, cities } = useActivities();
  const [selectedYear, setSelectedYear] = useState(years[0] || '');

  const topCities = useMemo(() => {
    const list = Object.entries(cities);
    list.sort((a, b) => b[1] - a[1]);
    return list.slice(0, 6);
  }, [cities]);

  const topRuns = useMemo(() => {
    return activities
      .slice()
      .sort((a, b) => b.distance - a.distance)
      .slice(0, 5);
  }, [activities]);

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
              <p className="card-subtitle">跑步最频繁的地点</p>
            </div>
            <div className="card-body">
              <ul className="summary-list">
                {topCities.map(([city, distance]) => (
                  <li key={city} className="summary-list-item">
                    <span>{city}</span>
                    <span>{(distance / M_TO_DIST).toFixed(1)} {DIST_UNIT}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="card summary-routes">
            <div className="card-header">
              <h2 className="card-title">Routes</h2>
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
            <h2 className="card-title">Report Builder</h2>
            <p className="card-subtitle">
              按年度、月度、周或单日生成统计卡片
            </p>
          </div>
          <div className="card-body">
            <ActivityList />
          </div>
        </section>

        <section className="card summary-route-grid">
          <div className="card-header">
            <h2 className="card-title">Route Grid</h2>
            <p className="card-subtitle">最新记录优先，10 列排布</p>
          </div>
          <div className="card-body">
            <div className="route-grid">
              {latestRuns.map((run) => (
                <div key={run.run_id} className="route-grid-item">
                  <RoutePreview activities={[run] as Activity[]} width={120} height={70} />
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
