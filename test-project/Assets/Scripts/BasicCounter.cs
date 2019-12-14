using System;

public class BasicCounter
{
  public const int MaxCount = 10;

  public BasicCounter(int count = 0)
  {
    Count = count;
  }

  public void Increment()
  {
    Count = Math.Min(MaxCount, Count + 1);
  }

  public int Count { get; private set; }
}
