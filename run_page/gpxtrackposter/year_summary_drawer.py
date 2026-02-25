"""Draw a Year Summary poster similar to Cursor stats style."""

import datetime
from collections import defaultdict

import svgwrite

from .tracks_drawer import TracksDrawer
from .xy import XY


class YearSummaryDrawer(TracksDrawer):
    """Draw a Year Summary poster with monthly activity dots and statistics"""

    def __init__(self, the_poster):
        super().__init__(the_poster)
        self.year = None

    def create_args(self, args_parser):
        args_parser.add_argument(
            "--summary-year",
            dest="summary_year",
            metavar="YEAR",
            type=int,
            default=None,
            help="Year to generate summary for (default: current year)",
        )

    def fetch_args(self, args):
        if args.type == "year_summary":
            self.year = args.summary_year or datetime.datetime.now().year

    def draw(self, dr: svgwrite.Drawing, size: XY, offset: XY):
        """Draw the year summary poster"""
        # Colors - use running_page default colors
        text_color = self.poster.colors.get("text", "#FFFFFF")
        track_color = self.poster.colors.get("track", "#4DD2FF")
        special_color = self.poster.colors.get("special", "#FFFF00")
        dim_color = "#555555"

        # Filter tracks for the specified year
        year_tracks = [
            t for t in self.poster.tracks if t.start_time_local.year == self.year
        ]

        # Calculate statistics
        stats = self._calculate_stats(year_tracks)

        # Full-width layout: only draw the monthly grid
        right_section_start = offset.x + 6

        # Draw monthly dots grid on right side - VERTICAL layout like Cursor
        self._draw_monthly_grid_vertical(
            dr,
            year_tracks,
            right_section_start,
            offset.y + 8,
            size.x - 12,
            size.y - 16,
            track_color,
            special_color,
            dim_color,
        )

    def _calculate_stats(self, tracks):
        """Calculate running statistics for the year"""
        stats = {
            "total_runs": len(tracks),
            "total_distance": 0,
            "marathon_count": 0,
            "half_marathon_count": 0,
            "10k_count": 0,
            "avg_pace": "0'00\"",
            "streak": 0,
            "total_time": 0,
            "longest_run": 0,
        }

        if not tracks:
            return stats

        total_distance_m = sum(t.length for t in tracks)
        total_time_s = 0
        longest_run_m = 0

        for t in tracks:
            dist_km = t.length / 1000
            # Track longest run
            if t.length > longest_run_m:
                longest_run_m = t.length

            # Count race distances
            if dist_km >= 42.0:
                stats["marathon_count"] += 1
            elif dist_km >= 21.0:
                stats["half_marathon_count"] += 1
            elif dist_km >= 10.0:
                stats["10k_count"] += 1

            # Calculate total moving time
            if t.moving_dict and "moving_time" in t.moving_dict:
                moving_time = t.moving_dict["moving_time"]
                if isinstance(moving_time, datetime.timedelta):
                    total_time_s += moving_time.total_seconds()
                else:
                    total_time_s += float(moving_time)
            elif t.end_time and t.start_time:
                if isinstance(t.end_time, datetime.datetime) and isinstance(
                    t.start_time, datetime.datetime
                ):
                    total_time_s += (t.end_time - t.start_time).total_seconds()

        stats["total_distance"] = self.poster.m2u(total_distance_m)
        stats["total_time"] = total_time_s
        stats["longest_run"] = self.poster.m2u(longest_run_m)

        # Calculate average pace (min per Unit)
        if total_distance_m > 0 and total_time_s > 0:
            pace_s_per_unit = total_time_s / self.poster.m2u(total_distance_m)
            pace_min = int(pace_s_per_unit // 60)
            pace_sec = int(pace_s_per_unit % 60)
            stats["avg_pace"] = f"{pace_min}'{pace_sec:02d}\""

        # Calculate streak (consecutive days)
        stats["streak"] = self._calculate_streak(tracks)

        return stats

    def _calculate_streak(self, tracks):
        """Calculate the longest running streak in days"""
        if not tracks:
            return 0

        # Get unique dates
        dates = sorted(set(t.start_time_local.date() for t in tracks))
        if not dates:
            return 0

        max_streak = 1
        current_streak = 1

        for i in range(1, len(dates)):
            if (dates[i] - dates[i - 1]).days == 1:
                current_streak += 1
                max_streak = max(max_streak, current_streak)
            else:
                current_streak = 1

        return max_streak

    def _get_first_run_date(self):
        """Get the date of the first run ever"""
        if not self.poster.tracks:
            return None
        return min(t.start_time_local for t in self.poster.tracks)

    def _draw_monthly_grid_vertical(
        self,
        dr,
        tracks,
        x_start,
        y_start,
        width,
        height,
        track_color,
        special_color,
        dim_color,
    ):
        """Draw the monthly activity grid - 12 columns (months), 31 rows (days)"""
        # Group tracks by month and day
        month_data = defaultdict(lambda: defaultdict(float))
        for t in tracks:
            month = t.start_time_local.month
            day = t.start_time_local.day
            month_data[month][day] += self.poster.m2u(t.length)

        # Grid parameters - 12 columns (months), 31 rows (days)
        cols = 12  # months
        rows = 31  # max days

        # Calculate spacing - make dots bigger with tighter spacing
        spacing_x = width / cols
        spacing_y = height / rows
        radius = min(spacing_x, spacing_y) / 2 * 0.75

        # Find max distance for color scaling
        max_dist = 1
        for month_days in month_data.values():
            for dist in month_days.values():
                max_dist = max(max_dist, dist)

        special_distance = self.poster.special_distance.get("special_distance", 10)

        # Draw dots - each column is a month, each row is a day
        for month in range(1, 13):
            for day in range(1, 32):
                # Check if this day exists in this month
                try:
                    datetime.date(self.year, month, day)
                except ValueError:
                    continue  # Invalid date (e.g., Feb 30)

                # Position: x = month (column), y = day (row)
                cx = x_start + (month - 1) * spacing_x + spacing_x / 2
                cy = y_start + (day - 1) * spacing_y + spacing_y / 2

                dist = month_data[month].get(day, 0)

                if dist > 0:
                    # Activity day - color based on distance
                    if dist >= special_distance:
                        color = special_color
                    else:
                        # Interpolate between dim and track color based on distance
                        intensity = min(dist / special_distance, 1.0)
                        color = self._interpolate_color(
                            dim_color, track_color, intensity
                        )
                else:
                    # No activity - dim dot
                    color = dim_color

                circle = dr.circle(center=(cx, cy), r=radius, fill=color)
                title = f"{self.year}-{month:02d}-{day:02d}"
                if dist > 0:
                    title += f": {int(dist) if dist >= 1 else round(dist, 1)} {self.poster.u()}"
                circle.set_desc(title=title)
                dr.add(circle)

    def _interpolate_color(self, color1, color2, t):
        """Interpolate between two hex colors"""

        def hex_to_rgb(hex_color):
            hex_color = hex_color.lstrip("#")
            return tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4))

        def rgb_to_hex(rgb):
            return "#{:02x}{:02x}{:02x}".format(*rgb)

        rgb1 = hex_to_rgb(color1)
        rgb2 = hex_to_rgb(color2)

        rgb = tuple(int(rgb1[i] + (rgb2[i] - rgb1[i]) * t) for i in range(3))
        return rgb_to_hex(rgb)
