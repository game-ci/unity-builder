using System.Collections;
using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;

namespace Tests
{
  public class SampleEditModeTest
  {
    [Test]
    public void TestIncrement()
    {
      // Given
      var counter = new BasicCounter(0);

      // When
      counter.Increment();

      // Then
      Assert.AreEqual(1, counter.Count);
    }

    [Test]
    public void TestMaxCount()
    {
      // Given
      var counter = new BasicCounter(BasicCounter.MaxCount);

      // When
      counter.Increment();

      // Then
      Assert.AreEqual(BasicCounter.MaxCount, counter.Count);
    }

  }
}
