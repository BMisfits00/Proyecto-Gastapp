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
  AccountDetail: { accountId: string; accountName: string };
};
