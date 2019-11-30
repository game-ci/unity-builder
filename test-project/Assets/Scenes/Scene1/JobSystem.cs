using System;
using System.Collections;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using Unity.Burst;
using Unity.Collections;
using Unity.Jobs;
using Unity.Mathematics;
using UnityEngine;
using UnityEngine.Jobs;
using Random = UnityEngine.Random;

public class JobSystem : MonoBehaviour
{
  [SerializeField] private bool useJobs;
  [SerializeField] private Transform transform;
  private List<Ball> balls;

  public class Ball
  {
    public Transform transform;
    public float moveY;
  }

  public void Start()
  {
    balls = new List<Ball>();
    for (int i = 0; i < 1000; i++)
    {
      Transform ballTransform = Instantiate(transform,
        new Vector3(Random.Range(-8f, 8f), Random.Range(-5f, 5f), Random.Range(-2f, 5f)), Quaternion.identity);
      balls.Add(new Ball
      {
        transform = ballTransform,
        moveY = Random.Range(-2f, 2f)
      });
    }
  }

  // Update is called once per frame
  private void Update()
  {
    float startTime = Time.realtimeSinceStartup;
    if (useJobs)
    {
      NativeArray<float> moveYArray = new NativeArray<float>(balls.Count, Allocator.TempJob);
      TransformAccessArray transformAccessArray = new TransformAccessArray(balls.Count);

      for (var i = 0; i < balls.Count; i++)
      {
        moveYArray[i] = balls[i].moveY;
        transformAccessArray.Add(balls[i].transform);
      }

      var reallyToughParallelJobTransforms = new ReallyToughParallelJobTransforms
      {
        deltaTime = Time.deltaTime,
        moveYArray = moveYArray
      };

      JobHandle jobHandle = reallyToughParallelJobTransforms.Schedule(transformAccessArray);
      jobHandle.Complete();

      for (int i = 0; i < balls.Count; i++)
      {
        balls[i].moveY = moveYArray[i];
      }

      moveYArray.Dispose();
      transformAccessArray.Dispose();
    }
    else
    {
      foreach (Ball ball in balls)
      {
        ball.transform.position += new Vector3(0, ball.moveY * Time.deltaTime);
        if (ball.transform.position.y > 5f)
        {
          ball.moveY = -Math.Abs(ball.moveY);
        }
        else if (ball.transform.position.y < -5f)
        {
          ball.moveY = Math.Abs(ball.moveY);
        }

        // Represents a tough task like some pathfinding or complex calculation
        var value = 0f;
        for (var i = 0; i < 250; i++)
        {
          value = math.exp10(math.sqrt(value));
        }
      }
    }

    var duration = $"{(Time.realtimeSinceStartup - startTime) * 1000f}ms";
    Debug.Log(duration);
  }
}

[BurstCompile]
public struct ReallyToughParallelJobTransforms : IJobParallelForTransform
{
  public NativeArray<float> moveYArray;
  [ReadOnly] public float deltaTime;

  public void Execute(int index, TransformAccess transform)
  {
    transform.position += new Vector3(0, moveYArray[index] * deltaTime, 0f);
    if (transform.position.y > 5f)
    {
      moveYArray[index] = -Math.Abs(moveYArray[index]);
    }
    else if (transform.position.y < -5f)
    {
      moveYArray[index] = Math.Abs(moveYArray[index]);
    }

    // Represents a tough task like some pathfinding or complex calculation
    var value = 0f;
    for (var i = 0; i < 250; i++)
    {
      value = math.exp10(math.sqrt(value));
    }
  }
}
