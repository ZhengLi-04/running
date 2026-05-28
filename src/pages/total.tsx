import { Helmet } from 'react-helmet-async';
import { useMemo, useState, lazy, Suspense, useEffect } from 'react';
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
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
  SportFilter,
  convertMovingTime2Sec,
  formatPace,
  locationDetailForRun,
  matchesSportType,
  SPORT_FILTER_LABELS,
} from '@/utils/utils';
import { Activity } from '@/utils/utils';

const SummaryPage = () => {
  const { theme } = useTheme();
  const { siteTitle } = useSiteMetadata();
  const { activities, sportTypes } = useActivities();
  const [selectedSport, setSelectedSport] = useState<SportFilter>('all');
  const [selectedYear, setSelectedYear] = useState('');
  const [reportInterval, setReportInterval] = useState<
    'year' | 'month' | 'week' | 'day'
  >('week');
  const [topRunsCount, setTopRunsCount] = useState(5);

  const filteredActivities = useMemo(() => {
    return activities.filter((run) => matchesSportType(run, selectedSport));
  }, [activities, selectedSport]);

  const filteredYears = useMemo(() => {
    return Array.from(
      new Set(filteredActivities.map((run) => run.start_date_local.slice(0, 4)))
    ).sort((a, b) => Number(b) - Number(a));
  }, [filteredActivities]);

  const topLocations = useMemo(() => {
    const map = new Map<string, number>();
    filteredActivities.forEach((run) => {
      const location =
        locationDetailForRun(run) || run.location_country || 'Unknown';
      map.set(location, (map.get(location) || 0) + run.distance);
    });
    const list = Array.from(map.entries());
    list.sort((a, b) => b[1] - a[1]);
    return list.slice(0, 6);
  }, [filteredActivities]);

  const topRuns = useMemo(() => {
    return filteredActivities
      .slice()
      .sort((a, b) => b.distance - a.distance)
      .slice(0, topRunsCount);
  }, [filteredActivities, topRunsCount]);

  const latestRuns = useMemo(() => {
    return filteredActivities
      .slice()
      .sort(
        (a, b) =>
          new Date(b.start_date_local).getTime() -
          new Date(a.start_date_local).getTime()
      )
      .slice(0, 30);
  }, [filteredActivities]);

  const YearSvg = useMemo(() => {
    if (!selectedYear) return null;
    return lazy(() =>
      loadSvgComponent(githubYearStats, `./github_${selectedYear}.svg`)
    );
  }, [selectedYear]);

  const yearRuns = useMemo(() => {
    if (!selectedYear) return filteredActivities;
    return filteredActivities.filter(
      (run) => run.start_date_local.slice(0, 4) === selectedYear
    );
  }, [filteredActivities, selectedYear]);

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

  const monthLabels = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  const yearCumulative = useMemo(() => {
    const monthDistance = new Array(12).fill(0);
    const monthTime = new Array(12).fill(0);
    yearRuns.forEach((run) => {
      const m = new Date(run.start_date_local).getMonth();
      monthDistance[m] += run.distance;
      monthTime[m] += convertMovingTime2Sec(run.moving_time);
    });

    const cumulativeDistance = monthDistance.reduce<number[]>((acc, v) => {
      acc.push((acc.at(-1) || 0) + v);
      return acc;
    }, []);

    const cumulativeTime = monthTime.reduce<number[]>((acc, v) => {
      acc.push((acc.at(-1) || 0) + v);
      return acc;
    }, []);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const selectedYearNum = Number(selectedYear);
    const isCurrentYear = selectedYearNum === currentYear;
    const isPastYear = selectedYearNum < currentYear;
    const cutoffMonth = isCurrentYear ? currentMonth : 11;

    const data = monthLabels.map((label, idx) => {
      const distanceKm = cumulativeDistance[idx] / M_TO_DIST;
      const timeHours = cumulativeTime[idx] / 3600;
      return {
        label,
        idx,
        distance: distanceKm,
        time: timeHours,
        actualDistance: idx <= cutoffMonth ? distanceKm : null,
        actualTime: idx <= cutoffMonth ? timeHours : null,
        futureDistance: isCurrentYear && idx >= cutoffMonth ? distanceKm : null,
        futureTime: isCurrentYear && idx >= cutoffMonth ? timeHours : null,
      };
    });

    return { data, isCurrentYear, isPastYear };
  }, [yearRuns, selectedYear]);

  const totalDistance = useMemo(() => {
    const sum = filteredActivities.reduce((acc, run) => acc + run.distance, 0);
    return `${(sum / M_TO_DIST).toFixed(1)} ${DIST_UNIT}`;
  }, [filteredActivities]);

  const totalDuration = useMemo(() => {
    const seconds = filteredActivities.reduce(
      (acc, run) => acc + convertMovingTime2Sec(run.moving_time),
      0
    );
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }, [filteredActivities]);

  const totalCities = useMemo(() => {
    return new Set(
      filteredActivities
        .map((run) => {
          return locationDetailForRun(run) || run.location_country || '';
        })
        .filter((x) => x.length > 0)
    ).size;
  }, [filteredActivities]);

  useEffect(() => {
    if (!filteredYears.length) {
      setSelectedYear('');
      return;
    }
    if (!selectedYear || !filteredYears.includes(selectedYear)) {
      setSelectedYear(filteredYears[0]);
    }
  }, [filteredYears, selectedYear]);

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
              <span className="pill">
                {filteredActivities.length} Activities
              </span>
              <span className="pill">Total Distance: {totalDistance}</span>
              <span className="pill">Total Time: {totalDuration}</span>
              <span className="pill">Total Cities: {totalCities}</span>
            </div>
            <div className="summary-tabs">
              {sportTypes.map((item) => (
                <button
                  key={item.value}
                  className={`filter-pill ${
                    selectedSport === item.value ? 'filter-pill-active' : ''
                  }`}
                  type="button"
                  onClick={() => setSelectedSport(item.value)}
                >
                  {item.label}
                </button>
              ))}
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
                {filteredYears.map((y) => (
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
              <div className="summary-year-content">
                {selectedSport === 'all' && YearSvg && (
                  <div className="summary-year-svg">
                    <Suspense fallback={<div>Loading...</div>}>
                      <YearSvg className="year-svg w-full" />
                    </Suspense>
                  </div>
                )}
                {selectedSport !== 'all' && (
                  <div className="summary-year-svg summary-year-placeholder">
                    Heatmap currently shows all activities. The charts and stats
                    on the right are filtered to{' '}
                    {SPORT_FILTER_LABELS[selectedSport]}.
                  </div>
                )}
                <div className="summary-year-trends">
                  <div className="summary-year-trend">
                    <h3>Cumulative Distance</h3>
                    <ResponsiveContainer>
                      <AreaChart data={yearCumulative.data}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--color-run-row-hover-background)"
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: 'var(--color-run-table-thead)' }}
                        />
                        <YAxis
                          tick={{ fill: 'var(--color-run-table-thead)' }}
                          width={32}
                        />
                        <Tooltip
                          formatter={(value: number) =>
                            `${value.toFixed(1)} ${DIST_UNIT}`
                          }
                          contentStyle={{
                            backgroundColor:
                              'var(--color-run-row-hover-background)',
                            border:
                              '1px solid var(--color-run-row-hover-background)',
                            color: 'var(--color-run-table-thead)',
                          }}
                          labelStyle={{ color: 'var(--color-primary)' }}
                        />
                        <Area
                          type="monotone"
                          dataKey="actualDistance"
                          stroke="var(--color-primary)"
                          fill="rgba(14, 116, 144, 0.2)"
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="futureDistance"
                          stroke="var(--color-primary)"
                          strokeDasharray="6 6"
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="summary-year-trend">
                    <h3>Cumulative Time</h3>
                    <ResponsiveContainer>
                      <AreaChart data={yearCumulative.data}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--color-run-row-hover-background)"
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: 'var(--color-run-table-thead)' }}
                        />
                        <YAxis
                          tick={{ fill: 'var(--color-run-table-thead)' }}
                          width={32}
                        />
                        <Tooltip
                          formatter={(value: number) => `${value.toFixed(1)} h`}
                          contentStyle={{
                            backgroundColor:
                              'var(--color-run-row-hover-background)',
                            border:
                              '1px solid var(--color-run-row-hover-background)',
                            color: 'var(--color-run-table-thead)',
                          }}
                          labelStyle={{ color: 'var(--color-primary)' }}
                        />
                        <Area
                          type="monotone"
                          dataKey="actualTime"
                          stroke="var(--color-accent, #f59e0b)"
                          fill="rgba(245, 158, 11, 0.2)"
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="futureTime"
                          stroke="var(--color-accent, #f59e0b)"
                          strokeDasharray="6 6"
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              <div className="summary-year-stats">
                <span className="pill">Activities: {yearStats.runs}</span>
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
              <p className="card-subtitle">距离最长的几次运动记录</p>
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
                {(['year', 'month', 'week', 'day'] as const).map((interval) => (
                  <button
                    key={interval}
                    className={`filter-pill ${
                      reportInterval === interval ? 'filter-pill-active' : ''
                    }`}
                    onClick={() => setReportInterval(interval)}
                  >
                    {interval}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="card-body">
            <ActivityList
              interval={reportInterval}
              onIntervalChange={setReportInterval}
              hideControls
              useContentHeight
              sportType={selectedSport}
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
                  <RoutePreview
                    activities={[run] as Activity[]}
                    width={150}
                    height={90}
                  />
                  <div className="route-grid-meta">
                    <span>{run.start_date_local.slice(0, 10)}</span>
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
