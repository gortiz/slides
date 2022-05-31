```mermaid
sequenceDiagram
   autonumber
   Customer ->>+ Broker: query
   
   Broker ->> Broker: parse
   
   Broker ->> Broker: optimization
   
   Broker ->> Broker: pruning by partition
   
   loop For each segment
     Broker ->>+ Server: query
     Server ->> Server: pruning by schema
     Server ->> Server: pruning by data
     Server ->> Server: execution
     Server ->>- Broker: partial result
   end
   
   Broker ->>- Customer:  total result
```