import { primaryColorRgb, secondaryColorRgb } from '@ghostfolio/common/config';
import {
  getDateFormatString,
  getLocale,
  getTextColor
} from '@ghostfolio/common/helper';
import { LineChartItem } from '@ghostfolio/common/interfaces';
import { ColorScheme } from '@ghostfolio/common/types';

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  type ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild
} from '@angular/core';
import {
  AgCharts,
  AllCommunityModule,
  ModuleRegistry,
  type AgAreaSeriesOptions,
  type AgCartesianChartOptions,
  type AgChartInstance,
  type AgLineSeriesOptions,
  type AgTooltipRendererResult
} from 'ag-charts-community';
import { format } from 'date-fns';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';

ModuleRegistry.registerModules([AllCommunityModule]);

interface AgLineGraphDatum {
  benchmark: number | null;
  date: Date;
  value: number | null;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgxSkeletonLoaderModule],
  selector: 'gf-ag-line-graph',
  styleUrls: ['./ag-line-graph.component.scss'],
  templateUrl: './ag-line-graph.component.html'
})
export class GfAgLineGraphComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @Input() benchmarkDataItems: LineChartItem[] = [];
  @Input() benchmarkLabel = '';
  @Input() colorScheme: ColorScheme;
  @Input() currency: string;
  @Input() historicalDataItems: LineChartItem[];
  @Input() label: string;
  @Input() locale = getLocale();
  @Input() showGradient = false;
  @Input() showLegend = false;
  @Input() showLoader = true;
  @Input() showXAxis = false;
  @Input() showYAxis = false;
  @Input() unit: string;
  @Input() yMax: number;
  @Input() yMaxLabel: string;
  @Input() yMin: number;
  @Input() yMinLabel: string;

  @ViewChild('chartContainer') chartContainer: ElementRef<HTMLDivElement>;

  public isLoading = true;

  private chart: AgChartInstance<AgCartesianChartOptions<AgLineGraphDatum>>;

  public constructor(private changeDetectorRef: ChangeDetectorRef) {}

  public ngAfterViewInit() {
    if (this.historicalDataItems) {
      setTimeout(() => {
        // Wait for the chartContainer
        this.initialize();

        this.changeDetectorRef.markForCheck();
      });
    }
  }

  public ngOnChanges() {
    if (this.historicalDataItems || this.historicalDataItems === null) {
      setTimeout(() => {
        // Wait for the chartContainer
        this.initialize();

        this.changeDetectorRef.markForCheck();
      });
    }
  }

  public ngOnDestroy() {
    this.chart?.destroy();
  }

  private async initialize() {
    this.isLoading = true;

    const data: AgLineGraphDatum[] = (this.historicalDataItems ?? []).map(
      (historicalDataItem, index) => {
        return {
          benchmark: this.benchmarkDataItems?.[index]?.value ?? null,
          date: new Date(historicalDataItem.date),
          value: historicalDataItem.value
        };
      }
    );

    if (this.chartContainer?.nativeElement) {
      const options = this.getChartOptions(data);

      if (this.chart) {
        await this.chart.update(options);
      } else {
        this.chart = AgCharts.create(options);
      }
    }

    this.isLoading = false;
  }

  private getChartOptions(
    data: AgLineGraphDatum[]
  ): AgCartesianChartOptions<AgLineGraphDatum> {
    const primaryColor = `rgb(${primaryColorRgb.r}, ${primaryColorRgb.g}, ${primaryColorRgb.b})`;
    const secondaryColor = `rgb(${secondaryColorRgb.r}, ${secondaryColorRgb.g}, ${secondaryColorRgb.b})`;
    const textColor = `rgb(${getTextColor(this.colorScheme)})`;
    const lineColor = `rgba(${getTextColor(this.colorScheme)}, 0.1)`;

    const series: (
      | AgAreaSeriesOptions<AgLineGraphDatum>
      | AgLineSeriesOptions<AgLineGraphDatum>
    )[] = [];

    if (this.benchmarkLabel) {
      series.push({
        type: 'line',
        connectMissingData: false,
        marker: { enabled: false },
        stroke: secondaryColor,
        strokeWidth: 1,
        tooltip: {
          renderer: (params) => this.getTooltipRendererResult(params)
        },
        xKey: 'date',
        yKey: 'benchmark',
        yName: this.benchmarkLabel
      });
    }

    series.push(
      this.showGradient
        ? {
            type: 'area',
            connectMissingData: false,
            fill: primaryColor,
            fillOpacity: 0.2,
            marker: { enabled: false },
            stroke: primaryColor,
            strokeWidth: 2,
            tooltip: {
              renderer: (params) => this.getTooltipRendererResult(params)
            },
            xKey: 'date',
            yKey: 'value',
            yName: this.label
          }
        : {
            type: 'line',
            connectMissingData: false,
            marker: { enabled: false },
            stroke: primaryColor,
            strokeWidth: 2,
            tooltip: {
              renderer: (params) => this.getTooltipRendererResult(params)
            },
            xKey: 'date',
            yKey: 'value',
            yName: this.label
          }
    );

    return {
      series,
      axes: {
        x: {
          type: 'time',
          gridLine: { enabled: false },
          label: {
            color: textColor,
            enabled: this.showXAxis,
            formatter: ({ value }) =>
              format(new Date(value), getDateFormatString(this.locale))
          },
          line: { enabled: this.showXAxis, stroke: lineColor },
          position: 'bottom',
          tick: { enabled: this.showXAxis, stroke: lineColor }
        },
        y: {
          type: 'number',
          gridLine: {
            enabled: this.showYAxis,
            style: [{ stroke: lineColor }]
          },
          label: {
            color: textColor,
            enabled: this.showYAxis,
            formatter: ({ value }) => {
              const numericValue = Number(value);

              if (this.yMinLabel && numericValue === this.yMin) {
                return this.yMinLabel;
              }

              if (this.yMaxLabel && numericValue === this.yMax) {
                return this.yMaxLabel;
              }

              return numericValue.toLocaleString(this.locale, {
                maximumFractionDigits: 2,
                minimumFractionDigits: 2
              });
            }
          },
          line: { enabled: false },
          max: this.yMax,
          min: this.yMin,
          position: 'right',
          tick: { enabled: false }
        }
      },
      background: { fill: 'transparent' },
      container: this.chartContainer?.nativeElement,
      data,
      legend: { enabled: this.showLegend, position: 'bottom' },
      theme: this.colorScheme === 'DARK' ? 'ag-default-dark' : 'ag-default'
    };
  }

  private getTooltipRendererResult({
    datum,
    xKey,
    yKey,
    yName
  }: {
    datum: AgLineGraphDatum;
    xKey: string;
    yKey: string;
    yName?: string;
  }): AgTooltipRendererResult {
    const value = datum[yKey as keyof AgLineGraphDatum] as number;

    if (value === null || value === undefined) {
      return { title: yName };
    }

    let formattedValue = value.toFixed(2);

    if (this.currency) {
      formattedValue = `${value.toLocaleString(this.locale, {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2
      })} ${this.currency}`;
    } else if (this.unit) {
      formattedValue = `${value.toFixed(2)} ${this.unit}`;
    }

    return {
      data: [{ label: yName ?? '', value: formattedValue }],
      heading: format(
        datum[xKey as keyof AgLineGraphDatum] as Date,
        getDateFormatString(this.locale)
      ),
      title: yName
    };
  }
}
