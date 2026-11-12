import { ConfirmationDialogType } from '@ghostfolio/common/enums';
import {
  DATE_FORMAT,
  getLocale,
  getLowercase,
  resolveMarketCondition
} from '@ghostfolio/common/helper';
import {
  AdminMarketDataDetails,
  AssetProfileIdentifier,
  Benchmark,
  LineChartItem,
  User
} from '@ghostfolio/common/interfaces';
import { NotificationService } from '@ghostfolio/ui/notifications';
import { DataService } from '@ghostfolio/ui/services';

import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { format } from 'date-fns';
import { addIcons } from 'ionicons';
import { ellipsisHorizontal, trashOutline } from 'ionicons/icons';
import { isNumber, round } from 'lodash';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';

import { GfAgLineGraphComponent } from '../ag-line-graph/ag-line-graph.component';
import { GfEntityLogoComponent } from '../entity-logo/entity-logo.component';
import { translate } from '../i18n';
import { GfTrendIndicatorComponent } from '../trend-indicator/trend-indicator.component';
import { GfValueComponent } from '../value/value.component';
import { GfBenchmarkDetailDialogComponent } from './benchmark-detail-dialog/benchmark-detail-dialog.component';
import { BenchmarkDetailDialogParams } from './benchmark-detail-dialog/interfaces/interfaces';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    GfAgLineGraphComponent,
    GfEntityLogoComponent,
    GfTrendIndicatorComponent,
    GfValueComponent,
    IonIcon,
    MatButtonModule,
    MatMenuModule,
    MatSortModule,
    MatTableModule,
    NgxSkeletonLoaderModule,
    RouterModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  selector: 'gf-benchmark',
  styleUrls: ['./benchmark.component.scss'],
  templateUrl: './benchmark.component.html'
})
export class GfBenchmarkComponent {
  public readonly benchmarks = input.required<Benchmark[]>();
  public readonly deviceType = input.required<string>();
  public readonly hasPermissionToDeleteItem = input<boolean>();
  public readonly locale = input(getLocale());
  public readonly showDetailsInline = input(false);
  public readonly showIcon = input(false);
  public readonly showSymbol = input(true);
  public readonly user = input<User>();

  public readonly itemDeleted = output<AssetProfileIdentifier>();

  protected readonly sort = viewChild(MatSort);

  protected readonly dataSource = new MatTableDataSource<Benchmark>([]);
  protected readonly displayedColumns = computed(() => {
    return [
      ...(this.showIcon() ? ['icon'] : []),
      'name',
      ...(this.user()?.settings?.isExperimentalFeatures
        ? ['trend50d', 'trend200d']
        : []),
      'date',
      'change',
      'marketCondition',
      'actions'
    ];
  });
  protected isLoading = true;
  protected readonly isLoadingSelectedItem = signal(false);
  protected readonly isNumber = isNumber;
  protected readonly resolveMarketCondition = resolveMarketCondition;
  protected readonly round = round;
  protected readonly selectedAssetProfile =
    signal<AdminMarketDataDetails['assetProfile']>(undefined);
  protected readonly selectedHistoricalDataItems = signal<LineChartItem[]>([]);
  protected readonly selectedItem = signal<AssetProfileIdentifier>(undefined);
  protected readonly selectedValue = signal<number>(undefined);
  protected readonly translate = translate;

  private readonly dataService = inject(DataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly notificationService = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  public constructor() {
    effect(() => {
      const benchmarks = this.benchmarks();

      if (benchmarks) {
        this.dataSource.data = benchmarks;
        this.dataSource.sortingDataAccessor = getLowercase;

        this.dataSource.sort = this.sort() ?? null;

        this.isLoading = false;

        const selectedItem = this.selectedItem();

        if (
          selectedItem &&
          !benchmarks.some(
            ({ dataSource, symbol }) =>
              dataSource === selectedItem.dataSource &&
              symbol === selectedItem.symbol
          )
        ) {
          this.selectedItem.set(undefined);
        }
      }
    });

    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        if (
          params['benchmarkDetailDialog'] &&
          params['dataSource'] &&
          params['symbol']
        ) {
          this.openBenchmarkDetailDialog({
            dataSource: params['dataSource'],
            symbol: params['symbol']
          });
        }
      });

    addIcons({ ellipsisHorizontal, trashOutline });
  }

  protected isSelected({ dataSource, symbol }: AssetProfileIdentifier) {
    const selectedItem = this.selectedItem();

    return (
      selectedItem?.dataSource === dataSource && selectedItem?.symbol === symbol
    );
  }

  protected onDeleteItem({ dataSource, symbol }: AssetProfileIdentifier) {
    this.notificationService.confirm({
      confirmFn: () => {
        this.itemDeleted.emit({ dataSource, symbol });
      },
      confirmType: ConfirmationDialogType.Warn,
      title: $localize`Do you really want to delete this item?`
    });
  }

  protected onOpenBenchmarkDialog({
    dataSource,
    symbol
  }: AssetProfileIdentifier) {
    this.router.navigate([], {
      queryParams: { dataSource, symbol, benchmarkDetailDialog: true }
    });
  }

  protected onSelectItem({ dataSource, symbol }: AssetProfileIdentifier) {
    if (!this.showDetailsInline() || this.deviceType() === 'mobile') {
      this.onOpenBenchmarkDialog({ dataSource, symbol });
      return;
    }

    this.selectedItem.set({ dataSource, symbol });
    this.isLoadingSelectedItem.set(true);

    this.dataService
      .fetchAsset({ dataSource, symbol })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ assetProfile, marketData }) => {
        let latestValue: number;

        const historicalDataItems = marketData.map(
          ({ date, marketPrice }, index) => {
            if (marketData.length - 1 === index) {
              latestValue = marketPrice;
            }

            return {
              date: format(date, DATE_FORMAT),
              value: marketPrice
            };
          }
        );

        this.selectedAssetProfile.set(assetProfile);
        this.selectedHistoricalDataItems.set(historicalDataItems);
        this.selectedValue.set(latestValue);
        this.isLoadingSelectedItem.set(false);
      });
  }

  private openBenchmarkDetailDialog({
    dataSource,
    symbol
  }: AssetProfileIdentifier) {
    const dialogRef = this.dialog.open<
      GfBenchmarkDetailDialogComponent,
      BenchmarkDetailDialogParams
    >(GfBenchmarkDetailDialogComponent, {
      data: {
        dataSource,
        symbol,
        colorScheme: this.user()?.settings?.colorScheme,
        deviceType: this.deviceType(),
        locale: this.locale()
      },
      height: this.deviceType() === 'mobile' ? '98vh' : undefined,
      width: this.deviceType() === 'mobile' ? '100vw' : '50rem'
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.router.navigate(['.'], { relativeTo: this.route });
      });
  }
}
