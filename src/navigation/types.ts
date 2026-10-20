import { Transaction } from '../types';

export type AppTabParamList = {
  Dashboard: undefined;
  Transactions: undefined;
  AddTab: undefined;
  Reports: undefined;
  Accounts: undefined;
};

export type RootStackParamList = {
  Tabs: undefined;
  AddTransaction: undefined;
  EditTransaction: { transaction: Transaction };
  AccountDetail: { accountId: string; accountName: string };
};
