import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeftRight, Plus, Minus, Calendar, TrendingUp, DollarSign, FileText } from 'lucide-react';
import type { ProcessedTransaction } from '../../services/transactionService';

interface TransactionCardProps {
  transaction: ProcessedTransaction;
}

const TransactionCard: React.FC<TransactionCardProps> = ({ transaction }) => {
  const getTransactionIcon = () => {
    switch (transaction.type) {
      case 'trade':
        return <ArrowLeftRight className="h-4 w-4" />;
      case 'free_agent':
        return <Plus className="h-4 w-4" />;
      case 'waiver':
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTransactionColor = () => {
    switch (transaction.type) {
      case 'trade':
        return 'bg-blue-100 text-blue-800';
      case 'free_agent':
        return 'bg-green-100 text-green-800';
      case 'waiver':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = () => {
    switch (transaction.status) {
      case 'complete':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  const formatTransactionType = (type: string) => {
    switch (type) {
      case 'free_agent':
        return 'Free Agent';
      case 'waiver':
        return 'Waiver';
      case 'trade':
        return 'Trade';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  return (
    <Card className="mb-4 hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`p-2 rounded-full ${getTransactionColor()}`}>
              {getTransactionIcon()}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <Badge className={getTransactionColor()}>
                  {formatTransactionType(transaction.type)}
                </Badge>
                <Badge variant="outline">Week {transaction.week}</Badge>
                <Badge className={getStatusColor()}>
                  {transaction.status}
                </Badge>
              </div>
              <div className="flex items-center space-x-1 mt-1 text-sm text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{formatDate(transaction.date)}</span>
              </div>
            </div>
          </div>
          
          {transaction.waiverBid &&
          <div className="flex items-center space-x-1 text-sm text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              <span>${transaction.waiverBid}</span>
            </div>
          }
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Transaction Details */}
          <div>
            <p className="text-sm font-medium text-foreground">{transaction.details}</p>
          </div>

          {/* Teams Involved */}
          {transaction.teams.length > 0 &&
          <div>
              <p className="text-xs text-muted-foreground mb-1">Teams:</p>
              <div className="flex flex-wrap gap-1">
                {transaction.teams.map((team, index) =>
              <Badge key={index} variant="secondary" className="text-xs">
                    {team}
                  </Badge>
              )}
              </div>
            </div>
          }

          {/* Player Movements */}
          {(transaction.players.added.length > 0 || transaction.players.dropped.length > 0) &&
          <div className="space-y-2">
              {transaction.players.added.length > 0 &&
            <div>
                  <p className="text-xs text-muted-foreground mb-1 flex items-center">
                    <Plus className="h-3 w-3 mr-1 text-green-600" />
                    Added:
                  </p>
                  <div className="space-y-1">
                    {transaction.players.added.map((player, index) =>
                <div key={index} className="flex items-center justify-between text-sm">
                        <span className="font-medium">{player.name}</span>
                        <Badge variant="outline" className="text-xs">
                          to {player.team}
                        </Badge>
                      </div>
                )}
                  </div>
                </div>
            }

              {transaction.players.dropped.length > 0 &&
            <div>
                  <p className="text-xs text-muted-foreground mb-1 flex items-center">
                    <Minus className="h-3 w-3 mr-1 text-red-600" />
                    Dropped:
                  </p>
                  <div className="space-y-1">
                    {transaction.players.dropped.map((player, index) =>
                <div key={index} className="flex items-center justify-between text-sm">
                        <span className="font-medium">{player.name}</span>
                        <Badge variant="outline" className="text-xs">
                          from {player.team}
                        </Badge>
                      </div>
                )}
                  </div>
                </div>
            }
            </div>
          }

          {/* Draft Picks */}
          {transaction.draftPicks.length > 0 &&
          <div>
              <p className="text-xs text-muted-foreground mb-1">Draft Picks:</p>
              <div className="space-y-1">
                {transaction.draftPicks.map((pick, index) =>
              <div key={index} className="text-sm">
                    <span className="font-medium">
                      {pick.season} Round {pick.round}
                    </span>
                    <span className="text-muted-foreground ml-2">
                      (Roster {pick.previous_owner_id} → Roster {pick.owner_id})
                    </span>
                  </div>
              )}
              </div>
            </div>
          }

          {/* FAAB Transfers */}
          {transaction.waiverBudget.length > 0 &&
          <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center">
                <DollarSign className="h-3 w-3 mr-1" />
                FAAB Transfers:
              </p>
              <div className="space-y-1">
                {transaction.waiverBudget.map((transfer, index) =>
              <div key={index} className="text-sm">
                    <span className="font-medium">${transfer.amount}</span>
                    <span className="text-muted-foreground ml-2">
                      (Roster {transfer.sender} → Roster {transfer.receiver})
                    </span>
                  </div>
              )}
              </div>
            </div>
          }

          {/* Notes */}
          {transaction.notes &&
          <>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Notes:</p>
                <p className="text-sm italic text-muted-foreground">{transaction.notes}</p>
              </div>
            </>
          }
        </div>
      </CardContent>
    </Card>);

};

export default TransactionCard;